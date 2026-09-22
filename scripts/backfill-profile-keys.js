/**
 * Backfill persisted `profileKey` (opaque HMAC public locator) for users
 * created before the field existed.
 *
 * SAFETY:
 * - Dry-run by default: reports what WOULD change, writes nothing.
 * - Pass --apply to write. Requires DB_URI + PUBLIC_PROFILE_KEY_SECRET
 *   (or APP_SECRET/JWT_SECRET fallback) in the environment.
 * - Idempotent: skips users that already have a key; re-running is safe.
 * - Never deletes or modifies any other field; uses save() so model hooks run.
 * - DO NOT run against production without a fresh backup and explicit approval.
 *
 * Usage:
 *   node scripts/backfill-profile-keys.js            # dry run
 *   node scripts/backfill-profile-keys.js --apply    # write
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');
const BATCH = 100;

function getSecret() {
    const secret =
        process.env.PUBLIC_PROFILE_KEY_SECRET ||
        process.env.APP_SECRET ||
        process.env.JWT_SECRET;
    if (!secret) {
        throw new Error(
            'Missing PUBLIC_PROFILE_KEY_SECRET (or APP_SECRET/JWT_SECRET fallback). Refusing to run.',
        );
    }
    return secret;
}

function profileKeyFor(secret, id) {
    return (
        'p_' +
        crypto
            .createHmac('sha256', secret)
            .update(String(id))
            .digest('base64url')
            .slice(0, 22)
    );
}

async function main() {
    console.log('=== PROFILEKEY BACKFILL ===');
    console.log(`Mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`);
    if (!process.env.DB_URI) {
        throw new Error('Missing DB_URI. Refusing to run.');
    }

    const secret = getSecret();
    await mongoose.connect(process.env.DB_URI);
    console.log('Connected to MongoDB.');

    const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');

    const total = await User.countDocuments({});
    const already = await User.countDocuments({ profileKey: { $ne: null } });
    console.log(`Users total: ${total}, already have profileKey: ${already}`);

    const cursor = User.find({ $or: [{ profileKey: null }, { profileKey: { $exists: false } }] })
        .select('_id')
        .cursor();

    let scanned = 0;
    let updated = 0;
    let skipped = 0;
    const seen = new Map();

    for await (const doc of cursor) {
        scanned += 1;
        const key = profileKeyFor(secret, doc._id);
        const clash = seen.get(key);
        if (clash && String(clash) !== String(doc._id)) {
            console.warn(`COLLISION: key ${key} for ${doc._id} already assigned to ${clash}; skipping.`);
            skipped += 1;
            continue;
        }
        seen.set(key, doc._id);
        if (!APPLY) {
            continue;
        }
        const res = await User.updateOne(
            { _id: doc._id, $or: [{ profileKey: null }, { profileKey: { $exists: false } }] },
            { $set: { profileKey: key } },
        );
        if (res.modifiedCount === 1) {
            updated += 1;
        } else {
            skipped += 1;
        }
        if ((scanned % BATCH === 0) || updated % BATCH === 0) {
            console.log(`... scanned=${scanned} updated=${updated} skipped=${skipped}`);
        }
    }

    console.log(`DONE. scanned=${scanned} updated=${updated} skipped=${skipped}`);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Backfill failed:', err && err.message ? err.message : err);
    process.exit(1);
});
