import mongoose from 'mongoose';

const slugify = require('slugify');

export async function generateUniqueSlug(doc: any) {
    const rawName = `${doc.firstname || ''} ${doc.lastname || ''}`.trim() || 'member';
    const baseSlug = slugify(rawName, { lower: true, strict: true }) || 'member';
    let uniqueSlug = baseSlug;
    let counter = 1;

    try {
        while (await mongoose.models.User.exists({ slug: uniqueSlug })) {
            uniqueSlug = `${baseSlug}-${counter}`;
            counter++;
            if (counter > 50) {
                uniqueSlug = `${baseSlug}-${Date.now()}`;
                break;
            }
        }
    } catch {
        uniqueSlug = `${baseSlug}-${Date.now()}`;
    }

    return uniqueSlug;
}

export async function generateProjectUniqueSlug(doc: any) {
    const baseSlug = slugify(`${doc.title || 'project'}`, { lower: true, strict: true }) || 'project';
    let uniqueSlug = baseSlug;
    let counter = 1;

    try {
        while (await mongoose.models.Project.exists({ slug: uniqueSlug })) {
            uniqueSlug = `${baseSlug}-${counter}`;
            counter++;
            if (counter > 50) {
                uniqueSlug = `${baseSlug}-${Date.now()}`;
                break;
            }
        }
    } catch {
        uniqueSlug = `${baseSlug}-${Date.now()}`;
    }

    return uniqueSlug;
}

export async function generateAlbumUniqueSlug(doc: any) {
    const baseSlug = slugify(`${doc.name || 'album'}`, { lower: true, strict: true }) || 'album';
    let uniqueSlug = baseSlug;
    let counter = 1;

    try {
        while (await mongoose.models.Project.exists({ slug: uniqueSlug })) {
            uniqueSlug = `${baseSlug}-${counter}`;
            counter++;
            if (counter > 50) {
                uniqueSlug = `${baseSlug}-${Date.now()}`;
                break;
            }
        }
    } catch {
        uniqueSlug = `${baseSlug}-${Date.now()}`;
    }

    return uniqueSlug;
}
