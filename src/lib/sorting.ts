/**
 * Ordina una lista di elementi con campo `nome` in ordine alfabetico A-Z.
 * Poiche' il campo nome e' salvato come "Nome Cognome" in un unico testo,
 * l'ordinamento alfabetico sull'intera stringa ordina prima per nome e poi
 * per cognome, coerentemente con come vengono registrati studenti/insegnanti.
 */
export function sortByNome<T extends { nome: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base' }));
}
