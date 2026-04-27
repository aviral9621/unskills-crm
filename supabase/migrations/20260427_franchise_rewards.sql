-- ============================================================================
-- Monthly Franchise Reward System + Certificate Point Wallet
-- ============================================================================
-- Tier thresholds (per IST month, branch):
--   10 admissions → silver  (+1 pt,  no gift)
--   20 admissions → gold    (+3 pt,  Ring Light)
--   30 admissions → platinum(+5 pt,  Printer / Smartwatch / Speaker)
--
-- Rule: only highest tier reached counts. Implemented via delta credits
-- (silver→gold credits +2; silver→platinum credits +4; gold→platinum +2).
-- ============================================================================

-- 1. Tracking table — dedupes admissions per (branch, student) ----------------
CREATE TABLE IF NOT EXISTS public.uce_branch_monthly_admissions (
  branch_id  uuid NOT NULL REFERENCES public.uce_branches(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.uce_students(id) ON DELETE CASCADE,
  year       int  NOT NULL,
  month      int  NOT NULL CHECK (month BETWEEN 1 AND 12),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (branch_id, student_id)
);
CREATE INDEX IF NOT EXISTS uce_bma_branch_year_month_idx
  ON public.uce_branch_monthly_admissions (branch_id, year, month, created_at);

-- 2. Monthly reward summary ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uce_branch_monthly_rewards (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        uuid NOT NULL REFERENCES public.uce_branches(id) ON DELETE CASCADE,
  year             int NOT NULL,
  month            int NOT NULL CHECK (month BETWEEN 1 AND 12),
  admission_count  int NOT NULL DEFAULT 0,
  level            text CHECK (level IN ('silver','gold','platinum')),
  points_credited  int NOT NULL DEFAULT 0,
  gift             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, year, month)
);
CREATE INDEX IF NOT EXISTS uce_bmr_period_idx
  ON public.uce_branch_monthly_rewards (year, month, admission_count DESC);

-- 3. Point ledger (single source of truth) ------------------------------------
CREATE TABLE IF NOT EXISTS public.uce_branch_point_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     uuid NOT NULL REFERENCES public.uce_branches(id) ON DELETE CASCADE,
  points        int  NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('reward_credit','certificate_used','admin_adjustment')),
  description   text NOT NULL,
  student_id    uuid REFERENCES public.uce_students(id) ON DELETE SET NULL,
  reward_id     uuid REFERENCES public.uce_branch_monthly_rewards(id) ON DELETE SET NULL,
  performed_by  uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS uce_bpt_branch_idx     ON public.uce_branch_point_transactions (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS uce_bpt_student_idx    ON public.uce_branch_point_transactions (student_id);
CREATE INDEX IF NOT EXISTS uce_bpt_reward_idx     ON public.uce_branch_point_transactions (reward_id);

-- 4. updated_at trigger -------------------------------------------------------
CREATE OR REPLACE FUNCTION public._uce_rewards_touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS uce_bmr_touch ON public.uce_branch_monthly_rewards;
CREATE TRIGGER uce_bmr_touch BEFORE UPDATE ON public.uce_branch_monthly_rewards
  FOR EACH ROW EXECUTE FUNCTION public._uce_rewards_touch_updated_at();

-- 5. Point balance view -------------------------------------------------------
CREATE OR REPLACE VIEW public.uce_branch_point_balances AS
SELECT
  b.id AS branch_id,
  COALESCE(SUM(t.points)  FILTER (WHERE t.points > 0), 0)::int AS total_earned,
  COALESCE(-SUM(t.points) FILTER (WHERE t.points < 0), 0)::int AS total_used,
  COALESCE(SUM(t.points), 0)::int                              AS balance
FROM public.uce_branches b
LEFT JOIN public.uce_branch_point_transactions t ON t.branch_id = b.id
GROUP BY b.id;

GRANT SELECT ON public.uce_branch_point_balances TO authenticated;

-- 6. RPC: record_franchise_admission -----------------------------------------
-- Called by trigger when a student is inserted. Idempotent per (branch, student).
-- Returns the new monthly reward state.
CREATE OR REPLACE FUNCTION public.record_franchise_admission(
  p_branch_id  uuid,
  p_student_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now_ist  timestamp := (now() AT TIME ZONE 'Asia/Kolkata');
  v_year     int       := extract(year  FROM v_now_ist)::int;
  v_month    int       := extract(month FROM v_now_ist)::int;
  v_reward   uce_branch_monthly_rewards%ROWTYPE;
  v_row_count bigint;
  v_new_level text;
  v_new_points_total int;
  v_delta int;
  v_gift  text;
  v_old_level text;
  v_tier_just_reached text;
BEGIN
  IF p_branch_id IS NULL OR p_student_id IS NULL THEN
    RETURN jsonb_build_object('skipped', true);
  END IF;

  -- 1) Dedupe — try to record this admission. ON CONFLICT means we already counted them.
  INSERT INTO public.uce_branch_monthly_admissions (branch_id, student_id, year, month)
  VALUES (p_branch_id, p_student_id, v_year, v_month)
  ON CONFLICT (branch_id, student_id) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count = 0 THEN
    SELECT * INTO v_reward FROM public.uce_branch_monthly_rewards
      WHERE branch_id = p_branch_id AND year = v_year AND month = v_month;
    RETURN jsonb_build_object(
      'level', v_reward.level,
      'admission_count', COALESCE(v_reward.admission_count, 0),
      'points_credited', COALESCE(v_reward.points_credited, 0),
      'tier_just_reached', NULL,
      'duplicate', true
    );
  END IF;

  -- 2) Upsert + lock the monthly row, increment count.
  INSERT INTO public.uce_branch_monthly_rewards (branch_id, year, month, admission_count)
  VALUES (p_branch_id, v_year, v_month, 0)
  ON CONFLICT (branch_id, year, month) DO NOTHING;

  SELECT * INTO v_reward
  FROM public.uce_branch_monthly_rewards
  WHERE branch_id = p_branch_id AND year = v_year AND month = v_month
  FOR UPDATE;

  v_old_level := v_reward.level;

  UPDATE public.uce_branch_monthly_rewards
     SET admission_count = admission_count + 1
   WHERE id = v_reward.id
   RETURNING * INTO v_reward;

  -- 3) Determine new tier from current admission_count.
  IF v_reward.admission_count >= 30 THEN
    v_new_level := 'platinum';
    v_new_points_total := 5;
    v_gift := 'Printer / Smartwatch / Speaker';
  ELSIF v_reward.admission_count >= 20 THEN
    v_new_level := 'gold';
    v_new_points_total := 3;
    v_gift := 'Ring Light';
  ELSIF v_reward.admission_count >= 10 THEN
    v_new_level := 'silver';
    v_new_points_total := 1;
    v_gift := NULL;
  ELSE
    v_new_level := NULL;
    v_new_points_total := 0;
    v_gift := NULL;
  END IF;

  v_tier_just_reached := NULL;

  -- 4) If tier upgraded, credit the delta to the ledger.
  IF v_new_level IS NOT NULL AND v_new_level IS DISTINCT FROM v_old_level THEN
    v_delta := v_new_points_total - v_reward.points_credited;
    v_tier_just_reached := v_new_level;

    IF v_delta > 0 THEN
      INSERT INTO public.uce_branch_point_transactions
        (branch_id, points, kind, description, reward_id)
      VALUES
        (p_branch_id, v_delta, 'reward_credit',
         format('%s tier reached (%s admissions in %s/%s) — +%s point%s',
                initcap(v_new_level), v_reward.admission_count, v_month, v_year, v_delta,
                CASE WHEN v_delta = 1 THEN '' ELSE 's' END),
         v_reward.id);
    END IF;

    UPDATE public.uce_branch_monthly_rewards
       SET level = v_new_level,
           points_credited = v_new_points_total,
           gift = v_gift
     WHERE id = v_reward.id
     RETURNING * INTO v_reward;
  END IF;

  RETURN jsonb_build_object(
    'level', v_reward.level,
    'admission_count', v_reward.admission_count,
    'points_credited', v_reward.points_credited,
    'gift', v_reward.gift,
    'tier_just_reached', v_tier_just_reached
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_franchise_admission(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_franchise_admission(uuid, uuid) TO authenticated;

-- 7. RPC: consume_franchise_point --------------------------------------------
-- Burns 1 point in lieu of the rupee certificate-fee debit at registration.
CREATE OR REPLACE FUNCTION public.consume_franchise_point(
  p_branch_id  uuid,
  p_student_id uuid,
  p_description text DEFAULT 'Certificate fee paid with 1 point'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance int;
  v_uid     uuid := auth.uid();
  v_role    text;
  v_caller_branch uuid;
BEGIN
  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id required';
  END IF;

  -- Authorisation: caller must be super-admin OR belong to this branch.
  v_role := uce_get_user_role(v_uid);
  IF v_role IS DISTINCT FROM 'super_admin' THEN
    v_caller_branch := uce_get_user_branch(v_uid);
    IF v_caller_branch IS NULL OR v_caller_branch <> p_branch_id THEN
      RAISE EXCEPTION 'Not authorised to consume points for this branch';
    END IF;
  END IF;

  SELECT balance INTO v_balance
  FROM public.uce_branch_point_balances
  WHERE branch_id = p_branch_id;

  IF COALESCE(v_balance, 0) < 1 THEN
    RAISE EXCEPTION 'Insufficient point balance';
  END IF;

  INSERT INTO public.uce_branch_point_transactions
    (branch_id, points, kind, description, student_id, performed_by)
  VALUES
    (p_branch_id, -1, 'certificate_used', p_description, p_student_id, v_uid);

  RETURN jsonb_build_object('balance', v_balance - 1);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_franchise_point(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_franchise_point(uuid, uuid, text) TO authenticated;

-- 8. RPC: admin_adjust_franchise_points --------------------------------------
-- Super-admin manual credit/debit with audit note.
CREATE OR REPLACE FUNCTION public.admin_adjust_franchise_points(
  p_branch_id uuid,
  p_points    int,
  p_note      text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
BEGIN
  v_role := uce_get_user_role(v_uid);
  IF v_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only super admin may adjust points';
  END IF;
  IF p_points = 0 THEN
    RAISE EXCEPTION 'Adjustment amount must be non-zero';
  END IF;
  IF p_note IS NULL OR length(trim(p_note)) = 0 THEN
    RAISE EXCEPTION 'A reason note is required';
  END IF;

  INSERT INTO public.uce_branch_point_transactions
    (branch_id, points, kind, description, performed_by)
  VALUES
    (p_branch_id, p_points, 'admin_adjustment', p_note, v_uid);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_franchise_points(uuid, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_franchise_points(uuid, int, text) TO authenticated;

-- 9. AFTER-INSERT trigger on uce_students ------------------------------------
CREATE OR REPLACE FUNCTION public._uce_students_after_insert_reward() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Rewards counting must NEVER block a student registration. Swallow any error
  -- and log a NOTICE so it shows up in postgres logs for super-admin review.
  IF NEW.branch_id IS NOT NULL THEN
    BEGIN
      PERFORM public.record_franchise_admission(NEW.branch_id, NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'record_franchise_admission failed for student % (branch %): %',
        NEW.id, NEW.branch_id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uce_students_after_insert_reward ON public.uce_students;
CREATE TRIGGER trg_uce_students_after_insert_reward
  AFTER INSERT ON public.uce_students
  FOR EACH ROW EXECUTE FUNCTION public._uce_students_after_insert_reward();

-- 10. RLS ---------------------------------------------------------------------
ALTER TABLE public.uce_branch_monthly_admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uce_branch_monthly_rewards    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uce_branch_point_transactions ENABLE ROW LEVEL SECURITY;

-- branch users can SELECT their own; super-admin can SELECT everything
DROP POLICY IF EXISTS bma_select ON public.uce_branch_monthly_admissions;
CREATE POLICY bma_select ON public.uce_branch_monthly_admissions
  FOR SELECT TO authenticated
  USING (
    uce_get_user_role(auth.uid()) = 'super_admin'
    OR branch_id = uce_get_user_branch(auth.uid())
  );

DROP POLICY IF EXISTS bmr_select ON public.uce_branch_monthly_rewards;
CREATE POLICY bmr_select ON public.uce_branch_monthly_rewards
  FOR SELECT TO authenticated
  USING (
    uce_get_user_role(auth.uid()) = 'super_admin'
    OR branch_id = uce_get_user_branch(auth.uid())
  );

DROP POLICY IF EXISTS bpt_select ON public.uce_branch_point_transactions;
CREATE POLICY bpt_select ON public.uce_branch_point_transactions
  FOR SELECT TO authenticated
  USING (
    uce_get_user_role(auth.uid()) = 'super_admin'
    OR branch_id = uce_get_user_branch(auth.uid())
  );

-- All writes go through SECURITY-DEFINER RPCs which bypass RLS.
-- Direct write paths are explicitly forbidden.
DROP POLICY IF EXISTS bma_no_direct_write ON public.uce_branch_monthly_admissions;
CREATE POLICY bma_no_direct_write ON public.uce_branch_monthly_admissions
  FOR ALL TO authenticated
  USING (uce_get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (uce_get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS bmr_no_direct_write ON public.uce_branch_monthly_rewards;
CREATE POLICY bmr_no_direct_write ON public.uce_branch_monthly_rewards
  FOR ALL TO authenticated
  USING (uce_get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (uce_get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS bpt_no_direct_write ON public.uce_branch_point_transactions;
CREATE POLICY bpt_no_direct_write ON public.uce_branch_point_transactions
  FOR ALL TO authenticated
  USING (uce_get_user_role(auth.uid()) = 'super_admin')
  WITH CHECK (uce_get_user_role(auth.uid()) = 'super_admin');
