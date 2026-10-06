CREATE TABLE IF NOT EXISTS fiesta (
  id SERIAL PRIMARY KEY,
  fecha_evento DATE NOT NULL,
  cedula_contratante VARCHAR(10) NOT NULL CHECK (cedula_contratante ~ '^[0-9]{6,10}$'),
  cantidad_invitados INTEGER NOT NULL CHECK (cantidad_invitados > 0),
  horas INTEGER NOT NULL CHECK (horas > 0),
  valor_por_invitado INTEGER NOT NULL,
  cuota_horas INTEGER NOT NULL,
  monto_total INTEGER NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);
