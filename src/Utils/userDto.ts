import { createHmac } from 'crypto';
import { getPublicProfileKeySecret } from '../config/auth';

const PUBLIC_OPTIONAL_FIELDS = [
    'email',
    'phone',
    'MSSV',
    'dob',
    'hometown',
    'school',
    'workplace',
    'job',
    'socials',
    'skills',
    'favourites',
    'description',
    'nickname',
    'leetcode',
] as const;

const SENSITIVE_PRIVATE_FIELDS = new Set(['phone', 'email', 'MSSV', 'dob']);

export const DEFAULT_PROFILE_VISIBILITY = Object.freeze(
    PUBLIC_OPTIONAL_FIELDS.reduce((visibility, field) => {
        visibility[field] = !SENSITIVE_PRIVATE_FIELDS.has(field);
        return visibility;
    }, {} as Record<(typeof PUBLIC_OPTIONAL_FIELDS)[number], boolean>),
);

const toPlainObject = (user: any) => (typeof user?.toObject === 'function' ? user.toObject() : user);

/**
 * Public navigation needs a stable identifier without disclosing a MongoDB ID.
 * It is deterministic for one deployment secret and cannot be reversed by a client.
 */
export const toPublicProfileKey = (user: any) => {
    const source = toPlainObject(user);
    const id = source?._id?.toString();
    if (!id) {
        return null;
    }
    return `p_${createHmac('sha256', getPublicProfileKeySecret()).update(id).digest('base64url').slice(0, 22)}`;
};

const referenceDto = (reference: any) => {
    const value = toPlainObject(reference);
    if (!value || typeof value !== 'object') {
        return null;
    }
    const { name, constant } = value;
    return { name: name || null, constant: constant || null };
};

const socialDto = (social: any) => {
    const value = toPlainObject(social);
    if (!value || typeof value !== 'object') {
        return null;
    }
    return { url: value.url || null, social: referenceDto(value.socialId) };
};

/** Public profiles never contain internal identifiers, account roles, or data that was not opted in. */
export const toPublicUserDto = (user: any) => {
    const source = toPlainObject(user);
    const visibility = source?.profileVisibility || DEFAULT_PROFILE_VISIBILITY;
    const result: Record<string, unknown> = {
        _id: source?._id?.toString() || null,
        profileKey: toPublicProfileKey(source),
        firstname: source?.firstname || null,
        lastname: source?.lastname || null,
        avatar: source?.avatar || null,
        positionId: referenceDto(source?.positionId),
        departments: Array.isArray(source?.departments)
            ? source.departments.map(referenceDto).filter(Boolean)
            : [],
        majorId: referenceDto(source?.majorId),
        gen: source?.gen || null,
        isExcellent: Boolean(source?.isExcellent),
        exp: typeof source?.exp === 'number' ? source.exp : 150,
        streakDays: typeof source?.streakDays === 'number' ? source.streakDays : 1,
        unlockedBadges: Array.isArray(source?.unlockedBadges) ? source.unlockedBadges : [],
        favoriteTrack: source?.favoriteTrack || null,
    };

    for (const field of PUBLIC_OPTIONAL_FIELDS) {
        const isSensitive = SENSITIVE_PRIVATE_FIELDS.has(field);
        const isAllowed = isSensitive ? visibility[field] === true : visibility[field] !== false;
        if (field !== 'leetcode' && isAllowed) {
            result[field] = field === 'socials' && Array.isArray(source?.socials)
                ? source.socials.map(socialDto).filter(Boolean)
                : source?.[field] ?? null;
        }
    }

    return result;
};

/** Only authenticated owners and administrators receive the complete account document. */
export const toPrivateUserDto = (user: any) => {
    const source = toPlainObject(user);
    const { password, __v, ...safeUser } = source || {};
    return safeUser;
};
