using System.Text.Json;

using Microsoft.EntityFrameworkCore;

using TiempoProcesos.API.Data;

using TiempoProcesos.API.DTOs;

using TiempoProcesos.API.Models;



namespace TiempoProcesos.API.Helpers;



public static class MantenimientoMaquinaContextoHelper

{

    public static readonly string[] TiposMantenimiento =

        ["Correctivo", "Preventivo", "Limpieza", "Ajuste", "Calibración"];



    public static string NormalizarNombre(string? valor) =>

        new string((valor ?? "").ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());



    public static async Task<HojaVidaMaquina?> ResolverHojaVidaPorMaquinaAsync(AppDbContext context, int maquinaId)

    {

        var maquina = await context.Maquinas.FindAsync(maquinaId);

        if (maquina == null) return null;



        var hojas = await context.HojasVidaMaquinas.Where(h => h.Activo).ToListAsync();

        var normMaq = NormalizarNombre(maquina.Nombre);

        if (string.IsNullOrEmpty(normMaq)) return null;



        return hojas.FirstOrDefault(h => NormalizarNombre(h.Nombre) == normMaq)

            ?? hojas.FirstOrDefault(h =>

            {

                var normH = NormalizarNombre(h.Nombre);

                return normH.Contains(normMaq) || normMaq.Contains(normH);

            });

    }



    public static async Task<HojaVidaMaquina?> ResolverHojaVidaDesdeDtoAsync(AppDbContext context, MantenimientoConsumoWriteDto dto)

    {

        if (dto.HojaVidaId.HasValue && dto.HojaVidaId > 0)

            return await context.HojasVidaMaquinas.FirstOrDefaultAsync(h => h.Id == dto.HojaVidaId && h.Activo);



        if (dto.MaquinaId.HasValue && dto.MaquinaId > 0)

            return await ResolverHojaVidaPorMaquinaAsync(context, dto.MaquinaId.Value);



        return null;

    }



    public static async Task<int?> ResolverMaquinaProduccionPorHojaVidaAsync(AppDbContext context, int hojaVidaId)

    {

        var hoja = await context.HojasVidaMaquinas.FindAsync(hojaVidaId);

        if (hoja == null) return null;



        var normH = NormalizarNombre(hoja.Nombre);

        if (string.IsNullOrEmpty(normH)) return null;



        var maquinas = await context.Maquinas.Where(m => m.Activo).ToListAsync();

        return maquinas.FirstOrDefault(m => NormalizarNombre(m.Nombre) == normH)?.Id

            ?? maquinas.FirstOrDefault(m =>

            {

                var normM = NormalizarNombre(m.Nombre);

                return normM.Contains(normH) || normH.Contains(normM);

            })?.Id;

    }



    public static string? SerializarActividadesIds(List<int>? ids) =>

        ids == null || ids.Count == 0 ? null : JsonSerializer.Serialize(ids);



    public static List<int> DeserializarActividadesIds(string? json)

    {

        if (string.IsNullOrWhiteSpace(json)) return [];

        try { return JsonSerializer.Deserialize<List<int>>(json) ?? []; }

        catch { return []; }

    }



    public static async Task AplicarCamposConsumoAsync(AppDbContext context, Mantenimiento_Consumo consumo, MantenimientoConsumoWriteDto dto)

    {

        consumo.HojaVidaId = dto.HojaVidaId > 0 ? dto.HojaVidaId : null;

        consumo.MaquinaId = dto.MaquinaId > 0 ? dto.MaquinaId : null;



        if (consumo.HojaVidaId.HasValue && !consumo.MaquinaId.HasValue)

            consumo.MaquinaId = await ResolverMaquinaProduccionPorHojaVidaAsync(context, consumo.HojaVidaId.Value);



        consumo.TipoMantenimiento = string.IsNullOrWhiteSpace(dto.TipoMantenimiento)

            ? null

            : dto.TipoMantenimiento.Trim();

        consumo.BitacoraId = dto.BitacoraId > 0 ? dto.BitacoraId : null;
        consumo.MantenimientoHojaVidaId = dto.MantenimientoHojaVidaId > 0 ? dto.MantenimientoHojaVidaId : null;
        consumo.ActividadesIds = SerializarActividadesIds(dto.ActividadIds);

    }

}


