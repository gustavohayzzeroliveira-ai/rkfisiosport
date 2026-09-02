import { supabase } from "./supabaseClient";

// Bucket público criado pelo script supabase-setup.sql. Guarda fotos e
// arquivos de exames anexados a pacientes e sessões.
const BUCKET = "arquivos";

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

// Faz upload de um arquivo para o Storage e devolve os metadados prontos
// para serem salvos dentro do prontuário (JSON) do paciente/sessão. O
// arquivo em si fica no Storage; só a referência (path/url) é salva no
// registro do paciente.
export async function uploadFile(file, folder) {
  const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
  const path = `${folder}/${Date.now()}-${randomSuffix()}${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return {
    id: Date.now().toString(36) + randomSuffix(),
    name: file.name,
    path,
    url: data.publicUrl,
    type: file.type || "",
    size: file.size || 0,
    uploadedAt: new Date().toISOString(),
  };
}

export async function deleteFile(path) {
  if (!path) return;
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch (e) {
    // se falhar em remover do Storage, ainda assim seguimos removendo a
    // referência do prontuário — não vale travar o usuário por isso.
    console.error("Erro ao remover arquivo do Storage:", e);
  }
}
