import mongoose from 'mongoose';

const slugify = require('slugify');

export async function generateUniqueSlug(doc: any) {
    const baseSlug = slugify(`${doc.firstname} ${doc.lastname}`, { lower: true, strict: true });
    let uniqueSlug = baseSlug;
    let counter = 1;

    while (await mongoose.models.User.exists({ slug: uniqueSlug })) {
        uniqueSlug = `${baseSlug}-${counter}`;
        counter++;
    }

    return uniqueSlug;
}
