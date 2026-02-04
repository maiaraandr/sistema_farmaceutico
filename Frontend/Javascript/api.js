const API_BASE = "http://127.0.0.1:8000/api";

export async function listarMedicamentos() {
  const res = await fetch(`${API_BASE}/medicamentos/`);
  if (!res.ok) throw new Error("Erro ao listar medicamentos");
  return await res.json();
}

export async function criarMedicamento(dados) {
  const res = await fetch(`${API_BASE}/medicamentos/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (!res.ok) {
    const erro = await res.text();
    throw new Error("Erro ao criar medicamento: " + erro);
  }
  return await res.json();
}

export async function deletarMedicamento(id) {
  const res = await fetch(`${API_BASE}/medicamentos/${id}/`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Erro ao deletar medicamento");
}
