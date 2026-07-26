-- Prevent duplicate document records from repeated processing of the same email attachment.
ALTER TABLE public.documents ADD CONSTRAINT documents_storage_path_unique UNIQUE (storage_path);
