const escapeHtml = (value: string): string =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Escapes the given text and wraps every occurrence of the search query into a `mark` element,
 * so that search matches can be highlighted inside menu rows.
 */
export const kbqHighlightSearchMatches = (text: string, query: string): string => {
    if (!query) return escapeHtml(text);

    const parts: string[] = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let lastIndex = 0;
    let idx = lowerText.indexOf(lowerQuery);

    while (idx !== -1) {
        parts.push(escapeHtml(text.slice(lastIndex, idx)));
        parts.push(`<mark class="kbq-column-menu-highlight">${escapeHtml(text.slice(idx, idx + query.length))}</mark>`);
        lastIndex = idx + query.length;
        idx = lowerText.indexOf(lowerQuery, lastIndex);
    }

    parts.push(escapeHtml(text.slice(lastIndex)));

    return parts.join('');
};
