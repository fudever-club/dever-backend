const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const R2_CONFIG = {
  endpoint: process.env.R2_ENDPOINT || 'https://0cf4dda6c36698e80db232829cf2ecce.r2.cloudflarestorage.com',
  bucket: process.env.R2_BUCKET_NAME || 'fu-dever-storage',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || 'ac51419c5e068e6665276b814f24dfdb',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '1744c1ff8af08b9a42a9566e3540dba846803612527e13a275e9a6821393b2be',
  apiServer: 'https://dever-backend-production.up.railway.app',
};

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_CONFIG.endpoint,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
});

function sanitizeName(name) {
  if (!name) return 'member';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function migrate() {
  console.log('=== FU-DEVER CLOUDFLARE R2 AVATAR MIGRATION ===');
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.DB_URI);
  console.log('Connected to MongoDB successfully.');

  const usersCollection = mongoose.connection.db.collection('users');
  const alumnisCollection = mongoose.connection.db.collection('alumnis');

  const usersToMigrate = await usersCollection.find({
    avatar: { $regex: 'ibb.co' }
  }).toArray();

  console.log(`Found ${usersToMigrate.length} members with avatars on ImgBB (i.ibb.co).\n`);

  let successCount = 0;
  let failCount = 0;
  const migratedList = [];

  for (let i = 0; i < usersToMigrate.length; i++) {
    const user = usersToMigrate[i];
    const originalUrl = user.avatar;
    const fullName = `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.email;
    const slug = sanitizeName(fullName);

    console.log(`[${i + 1}/${usersToMigrate.length}] Processing: ${fullName} (${user.email})`);
    console.log(`    Source URL: ${originalUrl}`);

    try {
      // 1. Download image from ImgBB
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(originalUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Failed to fetch from ImgBB: HTTP ${res.status}`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      let contentType = res.headers.get('content-type') || 'image/jpeg';
      let ext = '.jpg';
      if (contentType.includes('png')) ext = '.png';
      else if (contentType.includes('webp')) ext = '.webp';
      else if (contentType.includes('gif')) ext = '.gif';
      else if (originalUrl.endsWith('.png')) { ext = '.png'; contentType = 'image/png'; }
      else if (originalUrl.endsWith('.webp')) { ext = '.webp'; contentType = 'image/webp'; }

      // 2. Build Cloudflare R2 key
      const timestamp = Date.now();
      const randomHex = Math.random().toString(36).substring(2, 8);
      const key = `avatar/${timestamp}-${randomHex}-${slug}${ext}`;

      // 3. Upload to Cloudflare R2
      await s3.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }));

      // 4. Verify on R2
      await s3.send(new HeadObjectCommand({
        Bucket: R2_CONFIG.bucket,
        Key: key,
      }));

      // 5. Generate official Railway proxy URL
      const newUrl = `${R2_CONFIG.apiServer}/api/v1/upload/file/${key}`;

      // 6. Update user document in MongoDB
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { avatar: newUrl, updatedAt: new Date() } }
      );

      // Sync to alumni if applicable
      await alumnisCollection.updateMany(
        { userId: user._id },
        { $set: { avatar: newUrl } }
      );

      console.log(`    -> Uploaded to R2: ${key} (${buffer.length} bytes)`);
      console.log(`    -> Updated DB URL: ${newUrl}\n`);

      successCount++;
      migratedList.push({
        name: fullName,
        email: user.email,
        oldUrl: originalUrl,
        newUrl: newUrl,
        size: buffer.length,
      });
    } catch (err) {
      console.error(`    [ERROR] Failed to migrate ${fullName}: ${err.message}\n`);
      failCount++;
    }
  }

  console.log('==============================================');
  console.log(`MIGRATION FINISHED: ${successCount} successful, ${failCount} failed.`);
  console.log('==============================================');

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
