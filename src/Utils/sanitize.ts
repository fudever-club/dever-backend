import sanitizeHtml from 'sanitize-html';

/**
 * Server-side HTML sanitizer for member/admin-authored blog content.
 * Stored XSS payloads (`<script>`, event handlers, `javascript:` URLs) are
 * stripped on write, so every reader — including future surfaces that do not
 * sanitize on render — receives safe HTML.
 */
const codeClassFilter = (tagName: string, attribs: sanitizeHtml.Attributes) => {
    const classes = (attribs.class || '')
        .split(/\s+/)
        .filter((cls) => /^language-[\w-]+$/.test(cls));
    return {
        tagName,
        attribs: { ...attribs, class: classes.join(' ') },
    };
};

const blogSanitizeOptions: sanitizeHtml.IOptions = {
    allowedTags: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
        'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
        'h1', 'h2', 'h3', 'h4', 'a', 'img', 'hr',
    ],
    allowedAttributes: {
        // target/rel are allowlisted because transformTags injects them after filtering.
        a: ['href', 'title', 'target', 'rel'],
        img: ['src', 'alt', 'title', 'width', 'height'],
        code: ['class'],
        pre: ['class'],
    },
    allowedSchemes: ['http', 'https'],
    transformTags: {
        a: (tagName, attribs) => ({
            tagName,
            attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
        }),
        code: codeClassFilter,
        pre: codeClassFilter,
    },
};

export const sanitizeBlogHtml = (html: unknown): string =>
    typeof html === 'string' && html ? sanitizeHtml(html, blogSanitizeOptions) : '';

export const sanitizePlainText = (text: unknown, maxLength = 300): string => {
    if (typeof text !== 'string' || !text) {
        return '';
    }
    return sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} }).slice(0, maxLength);
};
