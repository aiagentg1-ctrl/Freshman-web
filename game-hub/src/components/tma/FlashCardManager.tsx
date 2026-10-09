"use client";

import { useEffect, useState } from "react";
import { FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  adminCreateFlashCard,
  adminDeleteFlashCard,
  adminGetFlashCards,
  adminUpdateFlashCard,
  type FlashCard,
} from "../../lib/api";

const inputClass = "w-full rounded-lg border border-gray-300 bg-white p-3 text-sm focus:border-[#1D70F5] focus:outline-none focus:ring-2 focus:ring-blue-100";

export default function FlashCardManager() {
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FlashCard | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setCards(await adminGetFlashCards());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load flash cards.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setTitle("");
    setContent("");
    setPublished(true);
    setMessage("");
    setError("");
  };

  const openEdit = (card: FlashCard) => {
    setEditing(card);
    setCreating(false);
    setTitle(card.title);
    setContent(card.html_content ?? "");
    setPublished(card.is_published);
    setMessage("");
    setError("");
  };

  const closeEditor = () => {
    setEditing(null);
    setCreating(false);
  };

  const readHtmlFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setContent(String(reader.result || ""));
    reader.onerror = () => setError("Could not read the selected HTML file.");
    reader.readAsText(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || content.trim().length < 10) return;
    setSaving(true);
    setError("");
    try {
      const payload = { title: title.trim(), html_content: content.trim(), is_published: published };
      if (editing) await adminUpdateFlashCard(editing.id, payload);
      else await adminCreateFlashCard(payload);
      setMessage(editing ? "Flash card updated." : "Flash card published.");
      closeEditor();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save flash card.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this flash card?")) return;
    try {
      await adminDeleteFlashCard(id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete flash card.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Game Flash Cards</h2>
          <p className="text-sm text-gray-500">HTML content is shown safely in the student Game tab.</p>
        </div>
        <button type="button" onClick={openCreate} className="flex min-h-10 items-center gap-2 rounded-lg bg-[#1D70F5] px-4 py-2 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {message && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

      {creating || editing ? (
        <form onSubmit={submit} className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">{editing ? "Edit flash card" : "New flash card"}</h3>
            <button type="button" onClick={closeEditor} className="text-gray-500" aria-label="Close editor"><X className="h-5 w-5" /></button>
          </div>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="Card title" required />
          <label className="block text-sm font-medium text-gray-700">
            Upload HTML file
            <input type="file" accept=".html,.htm,text/html" onChange={(event) => readHtmlFile(event.target.files?.[0] || null)} className="mt-2 block w-full text-xs text-gray-500" />
          </label>
          <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={8} className={`${inputClass} font-mono text-sm`} placeholder="Paste HTML content or upload an HTML file" required />
          <label className="flex items-center gap-3 text-sm font-semibold text-gray-700">
            <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} className="h-4 w-4 accent-[#1D70F5]" />
            Publish to students
          </label>
          <button type="submit" disabled={saving} className="w-full rounded-lg bg-[#1D70F5] px-4 py-3 font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save flash card"}</button>
        </form>
      ) : null}

      <div className="space-y-3">
        {loading ? (
          <p className="rounded-xl bg-white p-5 text-sm text-gray-500">Loading...</p>
        ) : cards.length === 0 ? (
          <p className="rounded-xl bg-white p-5 text-sm text-gray-500">No flash cards have been published.</p>
        ) : cards.map((card) => (
          <article key={card.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><FileText className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold text-gray-800">{card.title}</h3>
                <p className="mt-1 text-xs text-gray-500">{card.is_published ? "Published" : "Draft"} · {new Date(card.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => openEdit(card)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={`Edit ${card.title}`}><Pencil className="h-4 w-4" /></button>
                <button type="button" onClick={() => remove(card.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label={`Delete ${card.title}`}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
