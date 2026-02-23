DO $$ 
DECLARE
    row_record RECORD;
    v_tiros_eq NUMERIC;
    v_meta_base NUMERIC;
    v_meta_por_hora NUMERIC;
    v_meta_rendimiento NUMERIC;
    v_meta75 NUMERIC;
    v_meta75_diff NUMERIC;
    v_meta75_diff_bonif NUMERIC;
    v_vr_pagar NUMERIC;
    v_vr_pagar_bonif NUMERIC;
    v_tiros_referencia NUMERIC;
BEGIN
    FOR row_record IN 
        SELECT p.*, m."TirosReferencia", COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 7500) as "MetaBase"
        FROM "ProduccionDiaria" p
        JOIN "Maquinas" m ON p."MaquinaId" = m."Id"
        WHERE EXTRACT(MONTH FROM p."Fecha") = 1 AND EXTRACT(YEAR FROM p."Fecha") = 2026
    LOOP
        v_tiros_referencia := COALESCE(row_record."TirosReferencia", 0);
        v_meta_base := COALESCE(row_record."MetaBase", 0);

        -- 1. Tiros Equivalentes (Raw without bonif % yet, assuming bonif % is 1 for the math diff check)
        v_tiros_eq := ROUND((v_tiros_referencia * row_record."Cambios") + row_record."RendimientoFinal");
        
        -- 2. Meta 75%
        v_meta_por_hora := v_meta_base / 8.0;
        v_meta_rendimiento := v_meta_por_hora * COALESCE(row_record."TotalHoras", 0);
        
        -- THE FIX: ROUND IT FIRST!
        v_meta75 := ROUND(v_meta_rendimiento * 0.75);
        
        -- 3. Diferencia Total
        v_meta75_diff := v_tiros_eq - v_meta75;

        -- 4. Diferencia Bonificable
        -- TirosBonificables ya viene con el porcentaje bonificable aplicado (que suele ser 1 a menos de fallos de horario)
        v_meta75_diff_bonif := COALESCE(row_record."TirosBonificables", 0) - v_meta75;
        
        -- 5. Valores a Pagar
        -- Inferir si era un día no laborable (festivo/domingo) asumiendo que el Frontend lo guardó en 0 a pesar de haber excedido la meta.
        -- Cuidado: la UI vieja no redondeaba. Así que la fórmula vieja era (TirosEq - Meta75NoRounded) > 0.
        IF COALESCE(row_record."ValorAPagar", 0) = 0 AND ( (v_tiros_referencia * row_record."Cambios" + row_record."RendimientoFinal") - (v_meta_rendimiento * 0.75) ) > 0 THEN
            v_vr_pagar := 0;
            v_vr_pagar_bonif := 0;
        ELSE
            IF v_meta75_diff > 0 THEN
                v_vr_pagar := v_meta75_diff * COALESCE(row_record."ValorTiroSnapshot", 0);
            ELSE
                v_vr_pagar := 0;
            END IF;
            
            IF v_meta75_diff_bonif > 0 THEN
                v_vr_pagar_bonif := v_meta75_diff_bonif * COALESCE(row_record."ValorTiroSnapshot", 0);
            ELSE
                v_vr_pagar_bonif := 0;
            END IF;
        END IF;

        -- Actualizar fila
        UPDATE "ProduccionDiaria"
        SET "ValorAPagar" = ROUND(v_vr_pagar),
            "ValorAPagarBonificable" = ROUND(v_vr_pagar_bonif)
        WHERE "Id" = row_record."Id";
        
    END LOOP;
END $$;
