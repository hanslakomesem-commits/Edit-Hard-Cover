-- ZAIN.NET Nota Hard Cover V9.12.2
-- (1) Harga reseller kolektif dihitung server berdasarkan paket masing-masing mahasiswa.
--     Hard Cover 1/2/3 hari: Rp35.000/Rp30.000/Rp25.000 per jilid.
--     CD Rp7.000, Artikel Rp10.000, SKEK Rp3.000, Pisah File Rp5.000
--     per mahasiswa per paket (tidak dikalikan jumlah jilid).
-- (2) Admin boleh memasukkan tanggal setor yang terlewat <= 30 hari, tanpa
--     memalsukan created_at. Hari Minggu tidak dihitung dalam jadwal pengerjaan.
-- PRASYARAT: Migrasi reseller, admin, dan V9.12.1 sudah terpasang.
-- BACKUP DATABASE lebih dahulu. Fungsi lama dipertahankan untuk kompatibilitas.
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_create_nota_reseller_batch_v9122(
  p_partner_id uuid,
  p_members jsonb,
  p_faculty text,
  p_major text,
  p_notes text,
  p_received_date date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_company text;
  v_faculty text := btrim(coalesce(p_faculty,''));
  v_major text := btrim(coalesce(p_major,''));
  v_wib_today date := (timezone('Asia/Jakarta',now()))::date;
  v_pickup date;
  v_days_max integer := 1;
  v_day integer;
  v_qty integer;
  v_package integer;
  v_hc_rate bigint;
  v_hc_normal bigint;
  v_hc_count integer[] := ARRAY[0,0,0];
  v_addon_rate bigint;
  v_addon_normal bigint;
  v_member_total bigint;
  v_member_normal bigint;
  v_total bigint := 0;
  v_normal_total bigint := 0;
  v_services text[];
  v_service text;
  v_name text;
  v_prodi text;
  v_label text;
  v_breakdown jsonb;
  v_members jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_member jsonb;
  v_order_id uuid;
  v_token uuid;
  v_count integer;
  i integer;
BEGIN
  -- Operasi PRIVILEGED, tidak bisa dipanggil pelanggan anonim maupun reseller.
  IF (SELECT auth.uid()) IS NULL OR NOT public.is_nota_admin() THEN
    RAISE EXCEPTION 'Hanya admin ZAIN.NET yang dapat membuat nota reseller';
  END IF;
  IF p_partner_id IS NULL THEN
    RAISE EXCEPTION 'Pilih akun reseller yang terdaftar';
  END IF;
  SELECT btrim(company_name) INTO v_company
  FROM public.nota_partners
  WHERE user_id=p_partner_id AND approved IS TRUE
  FOR SHARE;
  IF NOT FOUND OR length(coalesce(v_company,'')) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Akun reseller tidak aktif atau tidak ditemukan';
  END IF;
  IF length(v_faculty) NOT BETWEEN 2 AND 160 OR length(v_major) NOT BETWEEN 2 AND 160 THEN
    RAISE EXCEPTION 'Fakultas dan prodi/keterangan wajib diisi';
  END IF;
  IF length(coalesce(p_notes,'')) > 450 THEN
    RAISE EXCEPTION 'Catatan admin maksimal 450 karakter';
  END IF;
  IF p_received_date IS NULL OR p_received_date > v_wib_today
     OR p_received_date < v_wib_today - 30 THEN
    RAISE EXCEPTION 'Tanggal setor harus hari ini atau maksimal 30 hari terakhir (WIB)';
  END IF;
  IF jsonb_typeof(p_members) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Daftar mahasiswa tidak valid';
  END IF;
  v_count := jsonb_array_length(p_members);
  IF v_count NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Daftar mahasiswa harus berisi 1–100 orang';
  END IF;

  FOR v_member IN SELECT value FROM jsonb_array_elements(p_members) LOOP
    IF jsonb_typeof(v_member) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Rincian mahasiswa tidak valid';
    END IF;
    v_name := btrim(coalesce(v_member->>'name',''));
    v_prodi := btrim(coalesce(v_member->>'prodi',''));
    IF length(v_name) NOT BETWEEN 2 AND 120 OR length(v_prodi) NOT BETWEEN 2 AND 120 THEN
      RAISE EXCEPTION 'Nama dan prodi setiap mahasiswa wajib diisi (2–120 karakter)';
    END IF;
    IF coalesce(v_member->>'qty','') !~ '^[0-9]{1,3}$'
       OR coalesce(v_member->>'days','') !~ '^[1-3]$'
       OR coalesce(v_member->>'packageId','') !~ '^[1-7]$' THEN
      RAISE EXCEPTION 'Jumlah, lama pengerjaan, atau pilihan paket reseller tidak valid';
    END IF;
    v_qty := (v_member->>'qty')::integer;
    v_day := (v_member->>'days')::integer;
    v_package := (v_member->>'packageId')::integer;
    IF v_qty NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'Jumlah jilid per mahasiswa 1–100';
    END IF;
    v_hc_count[v_day] := v_hc_count[v_day] + v_qty;
    IF v_hc_count[v_day] > 100 THEN
      RAISE EXCEPTION 'Maksimal 100 jilid untuk tiap pilihan lama pengerjaan dalam satu nota';
    END IF;
    v_days_max := greatest(v_days_max,v_day);
    v_hc_rate := CASE v_day WHEN 1 THEN 35000 WHEN 2 THEN 30000 ELSE 25000 END;
    v_hc_normal := CASE v_day WHEN 1 THEN 50000 WHEN 2 THEN 40000
      ELSE CASE WHEN v_faculty='Fakultas Syariah (FASYA)' THEN 32000 ELSE 30000 END END;

    -- Paket 1–6 resmi, atau paket 7 (custom). Harga layanan server tetap.
    v_services := ARRAY[]::text[];
    IF v_package=2 THEN v_services := ARRAY['CD'];
    ELSIF v_package=3 THEN v_services := ARRAY['Artikel'];
    ELSIF v_package=4 THEN v_services := ARRAY['CD','Artikel'];
    ELSIF v_package=5 THEN v_services := ARRAY['CD','Artikel','SKEK'];
    ELSIF v_package=6 THEN v_services := ARRAY['CD','Artikel','SKEK','Pisah-pisah File'];
    ELSIF v_package=7 THEN
      IF jsonb_typeof(v_member->'services') IS DISTINCT FROM 'array'
         OR jsonb_array_length(v_member->'services') > 4 THEN
        RAISE EXCEPTION 'Paket custom reseller harus berisi daftar layanan valid';
      END IF;
      FOR v_service IN SELECT value FROM jsonb_array_elements_text(v_member->'services') LOOP
        IF v_service IS NULL OR v_service NOT IN ('CD','Artikel','SKEK','Pisah-pisah File') THEN
          RAISE EXCEPTION 'Layanan tambahan tidak dikenali: %',v_service;
        END IF;
        IF array_position(v_services,v_service) IS NOT NULL THEN
          RAISE EXCEPTION 'Layanan reseller tidak boleh dipilih dua kali';
        END IF;
        v_services := array_append(v_services,v_service);
      END LOOP;
    END IF;

    v_member_total := v_qty * v_hc_rate;
    v_member_normal := v_qty * v_hc_normal;
    v_breakdown := jsonb_build_array(jsonb_build_object(
      'name','Hard Cover','qty',v_qty,'normal_price',v_hc_normal,'reseller_price',v_hc_rate
    ));
    v_label := 'Hard Cover';
    FOREACH v_service IN ARRAY v_services LOOP
      v_addon_rate := CASE v_service
        WHEN 'CD' THEN 7000 WHEN 'Artikel' THEN 10000
        WHEN 'SKEK' THEN 3000 WHEN 'Pisah-pisah File' THEN 5000 END;
      v_addon_normal := CASE v_service
        WHEN 'CD' THEN 10000 WHEN 'Artikel' THEN 20000
        WHEN 'SKEK' THEN 5000 WHEN 'Pisah-pisah File' THEN 10000 END;
      v_member_total := v_member_total + v_addon_rate;
      v_member_normal := v_member_normal + v_addon_normal;
      v_breakdown := v_breakdown || jsonb_build_array(jsonb_build_object(
        'name',v_service,'qty',1,'normal_price',v_addon_normal,'reseller_price',v_addon_rate
      ));
      v_label := v_label || ' + ' || v_service;
    END LOOP;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'kind','package','package_id',CASE WHEN v_package=7 THEN 1 ELSE v_package END,
      'custom_package',v_package=7,'label',v_label,'qty',v_qty,'days',v_day,
      'hard_cover_unit',v_hc_rate,'other_sum',v_member_total-v_qty*v_hc_rate,
      'subtotal',v_member_total,'standard_subtotal',v_member_normal,
      'price_breakdown',v_breakdown
    ));
    v_members := v_members || jsonb_build_array(jsonb_build_object(
      'name',v_name,'prodi',v_prodi,'qty',v_qty,'days',v_day,
      'packageId',v_package,'services',to_jsonb(v_services),
      'subtotal',v_member_total
    ));
    v_total := v_total + v_member_total;
    v_normal_total := v_normal_total + v_member_normal;
  END LOOP;
  IF v_total <= 0 OR v_total > 100000000 THEN
    RAISE EXCEPTION 'Total harga tidak valid';
  END IF;

  v_pickup := p_received_date;
  FOR i IN 1..v_days_max LOOP
    LOOP
      v_pickup := v_pickup + 1;
      EXIT WHEN extract(isodow FROM v_pickup) <> 7; -- Minggu libur
    END LOOP;
  END LOOP;

  -- Dibuat hari ini secara riil; DATE_IN adalah tanggal fisik diterima.
  -- created_at tetap DEFAULT now() agar tidak memalsukan waktu pencatatan.
  INSERT INTO public.nota_orders (
    date_in,pickup_date,processing_days,customer_name,phone,faculty,major,
    items,extras,notes,total,payment_choice,dp_requested,
    order_kind,reseller_company,reseller_students,partner_user_id
  ) VALUES (
    p_received_date,v_pickup,v_days_max,
    left('Kolektif '||v_company||' - '||v_count||' mahasiswa',120),'',
    v_faculty,v_major,v_items,'[]'::jsonb,coalesce(p_notes,''),v_total,
    'BAYAR_SAAT_AMBIL',0,'reseller',v_company,v_members,p_partner_id
  ) RETURNING id,access_token INTO v_order_id,v_token;

  RETURN jsonb_build_object(
    'id',v_order_id,'token',v_token,'total',v_total,'normal_total',v_normal_total,
    'received_date',p_received_date,'pickup_date',v_pickup,'created_at',(now() AT TIME ZONE 'Asia/Jakarta'),
    'state','PENDING'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_create_nota_reseller_batch_v9122(uuid,jsonb,text,text,text,date)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_nota_reseller_batch_v9122(uuid,jsonb,text,text,text,date)
  TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
