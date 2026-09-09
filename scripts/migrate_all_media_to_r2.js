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

function sanitize(str) {
  if (!str) return 'media';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40) || 'media';
}

async function uploadUrlToR2(url, category = 'media', retries = 2) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      let contentType = res.headers.get('content-type') || 'image/jpeg';
      let ext = '.jpg';
      if (contentType.includes('png') || url.endsWith('.png')) { ext = '.png'; contentType = 'image/png'; }
      else if (contentType.includes('webp') || url.endsWith('.webp')) { ext = '.webp'; contentType = 'image/webp'; }
      else if (contentType.includes('gif') || url.endsWith('.gif')) { ext = '.gif'; contentType = 'image/gif'; }

      const parsedUrl = new URL(url);
      const baseName = path.basename(parsedUrl.pathname, path.extname(parsedUrl.pathname));
      const cleanName = sanitize(baseName);
      const timestamp = Date.now();
      const randomHex = Math.random().toString(36).substring(2, 8);
      const key = `${category}/${timestamp}-${randomHex}-${cleanName}${ext}`;

      await s3.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }));

      const publicUrl = `${R2_CONFIG.apiServer}/api/v1/upload/file/${key}`;
      return { key, publicUrl, size: buffer.length };
    } catch (err) {
      if (attempt <= retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      } else {
        throw err;
      }
    }
  }
}

async function runWorkerPool(tasks, concurrency, workerFn) {
  let index = 0;
  const results = [];
  const total = tasks.length;

  const workers = Array.from({ length: concurrency }, async () => {
    while (index < total) {
      const currentIndex = index++;
      const item = tasks[currentIndex];
      try {
        const res = await workerFn(item, currentIndex, total);
        results.push({ item, success: true, res });
      } catch (err) {
        results.push({ item, success: false, error: err.message });
      }
    }
  });

  await Promise.all(workers);
  return results;
}

async function migrateAll() {
  console.log('=== FU-DEVER MASTER CLOUDFLARE R2 MEDIA MIGRATION ===');
  await mongoose.connect(process.env.DB_URI);
  console.log('Connected to MongoDB Atlas.');

  const db = mongoose.connection.db;

  // 1. Gather all unique ibb.co URLs across collections
  const urlCategoryMap = new Map(); // url -> category

  // Image activities
  const imgActivities = await db.collection('imageactivities').find({ url: /ibb.co/ }).toArray();
  imgActivities.forEach(d => urlCategoryMap.set(d.url, 'activities'));

  // Projects
  const projects = await db.collection('projects').find({ image: /ibb.co/ }).toArray();
  projects.forEach(d => urlCategoryMap.set(d.image, 'projects'));

  // Frames
  const frames = await db.collection('frames').find({ bannerUrl: /ibb.co/ }).toArray();
  frames.forEach(d => urlCategoryMap.set(d.bannerUrl, 'frames'));

  // Blogs
  const blogs = await db.collection('blogs').find({
    $or: [{ 'author.avatar': /ibb.co/ }, { coverImage: /ibb.co/ }]
  }).toArray();
  blogs.forEach(d => {
    if (d.author?.avatar?.includes('ibb.co')) urlCategoryMap.set(d.author.avatar, 'avatar');
    if (d.coverImage?.includes('ibb.co')) urlCategoryMap.set(d.coverImage, 'blogs');
  });

  // Albums
  const albums = await db.collection('albums').find({}).toArray();
  albums.forEach(album => {
    if (album.image?.includes('ibb.co')) urlCategoryMap.set(album.image, 'albums');
    const photoArr = album.imageList || album.photos;
    if (Array.isArray(photoArr)) {
      photoArr.forEach(p => {
        const pUrl = typeof p === 'string' ? p : p?.url;
        if (pUrl && pUrl.includes('ibb.co')) urlCategoryMap.set(pUrl, 'albums');
      });
    }
  });

  const uniqueUrls = Array.from(urlCategoryMap.entries()).map(([url, category]) => ({ url, category }));
  console.log(`Total unique ImgBB URLs to migrate: ${uniqueUrls.length}\n`);

  // 2. Download and Upload to Cloudflare R2 with worker pool (6 concurrent workers)
  const urlMap = new Map(); // oldUrl -> newUrl
  let processed = 0;

  console.log('Starting parallel Cloudflare R2 upload (6 concurrent workers)...');
  await runWorkerPool(uniqueUrls, 6, async ({ url, category }, i, total) => {
    try {
      const result = await uploadUrlToR2(url, category);
      urlMap.set(url, result.publicUrl);
      processed++;
      if (processed % 20 === 0 || processed === total) {
        console.log(`  [Progress] Uploaded ${processed}/${total} files to R2 (${Math.round(processed / total * 100)}%)`);
      }
    } catch (e) {
      console.warn(`  [Warning] Failed to fetch/upload ${url}: ${e.message}`);
    }
  });

  console.log(`\nUpload phase complete! Successfully pushed ${urlMap.size} objects to Cloudflare R2.\n`);

  // 3. Update MongoDB Collections
  console.log('Updating MongoDB collections with new Cloudflare R2 URLs...');

  // Update Image Activities
  let iaUpdated = 0;
  for (const doc of imgActivities) {
    const newUrl = urlMap.get(doc.url);
    if (newUrl) {
      await db.collection('imageactivities').updateOne(
        { _id: doc._id },
        { $set: { url: newUrl, updatedAt: new Date() } }
      );
      iaUpdated++;
    }
  }
  console.log(`- imageactivities: updated ${iaUpdated}/${imgActivities.length} documents.`);

  // Update Projects
  let projUpdated = 0;
  for (const doc of projects) {
    const newUrl = urlMap.get(doc.image);
    if (newUrl) {
      await db.collection('projects').updateOne(
        { _id: doc._id },
        { $set: { image: newUrl, updatedAt: new Date() } }
      );
      projUpdated++;
    }
  }
  console.log(`- projects: updated ${projUpdated}/${projects.length} documents.`);

  // Update Frames
  let framesUpdated = 0;
  for (const doc of frames) {
    const newUrl = urlMap.get(doc.bannerUrl);
    if (newUrl) {
      await db.collection('frames').updateOne(
        { _id: doc._id },
        { $set: { bannerUrl: newUrl, updatedAt: new Date() } }
      );
      framesUpdated++;
    }
  }
  console.log(`- frames: updated ${framesUpdated}/${frames.length} documents.`);

  // Update Blogs
  let blogsUpdated = 0;
  for (const doc of blogs) {
    const update = {};
    if (doc.author?.avatar && urlMap.has(doc.author.avatar)) {
      update['author.avatar'] = urlMap.get(doc.author.avatar);
    }
    if (doc.coverImage && urlMap.has(doc.coverImage)) {
      update['coverImage'] = urlMap.get(doc.coverImage);
    }
    if (Object.keys(update).length > 0) {
      await db.collection('blogs').updateOne({ _id: doc._id }, { $set: update });
      blogsUpdated++;
    }
  }
  console.log(`- blogs: updated ${blogsUpdated}/${blogs.length} documents.`);

  // Update Albums
  let albumsUpdated = 0;
  for (const doc of albums) {
    let modified = false;
    let newCover = doc.image;
    if (doc.image && urlMap.has(doc.image)) {
      newCover = urlMap.get(doc.image);
      modified = true;
    }
    const updateObj = { updatedAt: new Date() };
    if (modified) updateObj.image = newCover;

    if (Array.isArray(doc.imageList)) {
      const newImageList = doc.imageList.map(p => {
        const pUrl = typeof p === 'string' ? p : p?.url;
        if (pUrl && urlMap.has(pUrl)) {
          modified = true;
          return typeof p === 'string' ? urlMap.get(pUrl) : { ...p, url: urlMap.get(pUrl) };
        }
        return p;
      });
      if (modified) updateObj.imageList = newImageList;
    }

    if (Array.isArray(doc.photos)) {
      const newPhotos = doc.photos.map(p => {
        const pUrl = typeof p === 'string' ? p : p?.url;
        if (pUrl && urlMap.has(pUrl)) {
          modified = true;
          return typeof p === 'string' ? urlMap.get(pUrl) : { ...p, url: urlMap.get(pUrl) };
        }
        return p;
      });
      if (modified) updateObj.photos = newPhotos;
    }

    if (modified) {
      await db.collection('albums').updateOne(
        { _id: doc._id },
        { $set: updateObj }
      );
      albumsUpdated++;
    }
  }
  console.log(`- albums: updated ${albumsUpdated}/${albums.length} documents.`);

  // Update Notifications
  const notifs = await db.collection('notifications').find({}).toArray();
  let notifsUpdated = 0;
  for (const doc of notifs) {
    let str = JSON.stringify(doc);
    let changed = false;
    for (const [oldUrl, newUrl] of urlMap.entries()) {
      if (str.includes(oldUrl)) {
        str = str.split(oldUrl).join(newUrl);
        changed = true;
      }
    }
    if (changed) {
      const parsed = JSON.parse(str);
      delete parsed._id;
      await db.collection('notifications').updateOne({ _id: doc._id }, { $set: parsed });
      notifsUpdated++;
    }
  }
  console.log(`- notifications: updated ${notifsUpdated} documents.`);

  console.log('\n=============================================================');
  console.log(`ALL MEDIA MIGRATION COMPLETED SUCCESSFULLY!`);
  console.log(`Total objects migrated to Cloudflare R2: ${urlMap.size}`);
  console.log('=============================================================');

  await mongoose.disconnect();
}

migrateAll().catch(err => {
  console.error('Fatal media migration error:', err);
  process.exit(1);
});
