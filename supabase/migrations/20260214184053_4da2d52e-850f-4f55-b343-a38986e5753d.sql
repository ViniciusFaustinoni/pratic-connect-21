ALTER TABLE sinistros 
  ADD COLUMN tipo_agua TEXT CHECK (tipo_agua IN ('doce', 'salgada'));