CREATE TABLE IF NOT EXISTS "Adjunto_DocumentoExtraccion" (
    "Id" SERIAL PRIMARY KEY,
    "Numero" character varying(32) NOT NULL,
    "Tipo" character varying(16) NOT NULL,
    "ArchivoNombre" character varying(260) NOT NULL,
    "RutaRelativa" character varying(500) NULL,
    "Metodo" character varying(32) NOT NULL DEFAULT 'PdfText',
    "TextoCompleto" text NOT NULL DEFAULT '',
    "DatosJson" text NOT NULL DEFAULT '{}',
    "HashArchivo" character varying(64) NULL,
    "FechaExtraccion" timestamp without time zone NOT NULL DEFAULT NOW(),
    "ErrorExtraccion" text NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_AdjuntoExtraccion_Numero_Tipo_Archivo"
    ON "Adjunto_DocumentoExtraccion" ("Numero", "Tipo", "ArchivoNombre");
