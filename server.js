/* Tbose Tutors Express Backend Server */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const os = require('os');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const isVercel = process.env.VERCEL || false;
const appUrl = process.env.APP_URL || 'http://localhost:3000';

// Determine writable paths (Vercel filesystem is read-only except /tmp)
const ticketsDir = isVercel ? path.join(os.tmpdir(), 'tickets') : path.join(__dirname, 'tickets');
const uploadDir = isVercel ? path.join(os.tmpdir(), 'uploads') : path.join(__dirname, 'public', 'uploads');
const secureUploadDir = isVercel ? path.join(os.tmpdir(), 'secure_uploads') : path.join(__dirname, 'secure_uploads');

// Ensure upload folder exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Ensure secure upload folder exists
if (!fs.existsSync(secureUploadDir)) {
    fs.mkdirSync(secureUploadDir, { recursive: true });
}

// Multer storage setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Safe filename with timestamp
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        cb(null, Date.now() + '-' + safeName);
    }
});
const upload = multer({ storage: storage });

// Secure Multer storage setup for paid products (uses Memory Storage for Firebase/Serverless compatibility)
const secureUpload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir)); // Explicitly route uploads directory for dynamic serverless storage

// Clean Routing for Student Portal
app.get('/portal', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'portal.html'));
});

// Clean Routing for Admin Dashboard
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Ensure folders exist
if (!fs.existsSync(ticketsDir)) {
    fs.mkdirSync(ticketsDir, { recursive: true });
}

// ----------------------------------------------------
// 1. DATABASE SETUP (Firebase Firestore / Mock Database)
// ----------------------------------------------------
let db = null;
let isFirebaseConnected = false;

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (serviceAccountJson) {
    try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`;
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: bucketName
        });
        db = admin.firestore();
        isFirebaseConnected = true;
        console.log(`✔ Connected to Firebase Firestore & Storage (${bucketName}) successfully using service account JSON string.`);
    } catch (err) {
        console.error('❌ Failed to initialize Firebase from service account JSON string:', err.message);
    }
} else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    try {
        const serviceAccount = require(path.resolve(serviceAccountPath));
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`;
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: bucketName
        });
        db = admin.firestore();
        isFirebaseConnected = true;
        console.log(`✔ Connected to Firebase Firestore & Storage (${bucketName}) successfully from key file.`);
    } catch (err) {
        console.error('❌ Failed to initialize Firebase from key file:', err.message);
    }
}

// Simulated local JSON database fallback (written to /tmp in Vercel environment)
const mockDbPath = isVercel ? path.join(os.tmpdir(), 'db_mock.json') : path.join(__dirname, 'db_mock.json');
if (!fs.existsSync(mockDbPath)) {
    fs.writeFileSync(mockDbPath, JSON.stringify([], null, 2));
}

async function saveAttendee(attendee) {
    if (isFirebaseConnected && db) {
        await db.collection('attendees').doc(attendee.ticketId).set(attendee, { merge: true });
    } else {
        const data = JSON.parse(fs.readFileSync(mockDbPath));
        const index = data.findIndex(item => item.ticketId === attendee.ticketId);
        if (index > -1) {
            data[index] = { ...data[index], ...attendee };
        } else {
            data.push(attendee);
        }
        fs.writeFileSync(mockDbPath, JSON.stringify(data, null, 2));
    }
}

async function getAttendeeByTicketId(ticketId) {
    if (isFirebaseConnected && db) {
        const doc = await db.collection('attendees').doc(ticketId).get();
        return doc.exists ? doc.data() : null;
    } else {
        const data = JSON.parse(fs.readFileSync(mockDbPath));
        return data.find(item => item.ticketId === ticketId) || null;
    }
}

async function getAllAttendees() {
    if (isFirebaseConnected && db) {
        const snapshot = await db.collection('attendees').orderBy('registeredAt', 'desc').get();
        const list = [];
        snapshot.forEach(doc => list.push(doc.data()));
        return list;
    } else {
        return JSON.parse(fs.readFileSync(mockDbPath));
    }
}

// Resources DB Helper Functions (dual Firestore/Mock DB setup)
const resourcesMockPath = isVercel ? path.join(os.tmpdir(), 'db_resources_mock.json') : path.join(__dirname, 'db_resources_mock.json');
if (!fs.existsSync(resourcesMockPath)) {
    fs.writeFileSync(resourcesMockPath, JSON.stringify([], null, 2));
}

async function saveResource(resource) {
    if (isFirebaseConnected && db) {
        await db.collection('resources').doc(resource.id).set(resource, { merge: true });
    } else {
        const data = JSON.parse(fs.readFileSync(resourcesMockPath, 'utf8'));
        const index = data.findIndex(item => item.id === resource.id);
        if (index > -1) {
            data[index] = { ...data[index], ...resource };
        } else {
            data.push(resource);
        }
        fs.writeFileSync(resourcesMockPath, JSON.stringify(data, null, 2));
    }
}

async function getAllResources() {
    if (isFirebaseConnected && db) {
        const snapshot = await db.collection('resources').orderBy('uploadedAt', 'desc').get();
        const list = [];
        snapshot.forEach(doc => list.push(doc.data()));
        return list;
    } else {
        return JSON.parse(fs.readFileSync(resourcesMockPath, 'utf8'));
    }
}

async function deleteResourceFromDb(id) {
    if (isFirebaseConnected && db) {
        await db.collection('resources').doc(id).delete();
    } else {
        let data = JSON.parse(fs.readFileSync(resourcesMockPath, 'utf8'));
        data = data.filter(item => item.id !== id);
        fs.writeFileSync(resourcesMockPath, JSON.stringify(data, null, 2));
    }
}

async function getResourceById(id) {
    if (isFirebaseConnected && db) {
        const doc = await db.collection('resources').doc(id).get();
        return doc.exists ? doc.data() : null;
    } else {
        const data = JSON.parse(fs.readFileSync(resourcesMockPath, 'utf8'));
        return data.find(item => item.id === id) || null;
    }
}

// Announcements DB Helper Functions (dual Firestore/Mock DB setup)
const announcementsMockPath = isVercel ? path.join(os.tmpdir(), 'db_announcements_mock.json') : path.join(__dirname, 'db_announcements_mock.json');
if (!fs.existsSync(announcementsMockPath)) {
    fs.writeFileSync(announcementsMockPath, JSON.stringify([], null, 2));
}

async function saveAnnouncement(announcement) {
    if (isFirebaseConnected && db) {
        await db.collection('announcements').doc(announcement.id).set(announcement, { merge: true });
    } else {
        const data = JSON.parse(fs.readFileSync(announcementsMockPath, 'utf8'));
        const index = data.findIndex(item => item.id === announcement.id);
        if (index > -1) {
            data[index] = { ...data[index], ...announcement };
        } else {
            data.push(announcement);
        }
        fs.writeFileSync(announcementsMockPath, JSON.stringify(data, null, 2));
    }
}

async function deleteAnnouncementFromDb(id) {
    if (isFirebaseConnected && db) {
        await db.collection('announcements').doc(id).delete();
    } else {
        const data = JSON.parse(fs.readFileSync(announcementsMockPath, 'utf8'));
        const filtered = data.filter(item => item.id !== id);
        fs.writeFileSync(announcementsMockPath, JSON.stringify(filtered, null, 2));
    }
}

async function getAllAnnouncements() {
    if (isFirebaseConnected && db) {
        const snapshot = await db.collection('announcements').orderBy('sentAt', 'desc').get();
        const list = [];
        snapshot.forEach(doc => list.push(doc.data()));
        return list;
    } else {
        return JSON.parse(fs.readFileSync(announcementsMockPath, 'utf8'));
    }
}

// Products DB Helper Functions (dual Firestore/Mock DB setup)
const productsMockPath = isVercel ? path.join(os.tmpdir(), 'db_products_mock.json') : path.join(__dirname, 'db_products_mock.json');
if (!fs.existsSync(productsMockPath)) {
    fs.writeFileSync(productsMockPath, JSON.stringify([], null, 2));
}

async function saveProduct(product) {
    if (isFirebaseConnected && db) {
        await db.collection('products').doc(product.id).set(product, { merge: true });
    } else {
        const data = JSON.parse(fs.readFileSync(productsMockPath, 'utf8'));
        const index = data.findIndex(item => item.id === product.id);
        if (index > -1) {
            data[index] = { ...data[index], ...product };
        } else {
            data.push(product);
        }
        fs.writeFileSync(productsMockPath, JSON.stringify(data, null, 2));
    }
}

async function getAllProducts() {
    if (isFirebaseConnected && db) {
        const snapshot = await db.collection('products').get();
        const list = [];
        snapshot.forEach(doc => list.push(doc.data()));
        // Sort by createdAt desc manually if Firestore doesn't have index or local sort
        return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
        const list = JSON.parse(fs.readFileSync(productsMockPath, 'utf8'));
        return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
}

async function getProductById(id) {
    if (isFirebaseConnected && db) {
        const doc = await db.collection('products').doc(id).get();
        return doc.exists ? doc.data() : null;
    } else {
        const data = JSON.parse(fs.readFileSync(productsMockPath, 'utf8'));
        return data.find(item => item.id === id) || null;
    }
}

async function deleteProductFromDb(id) {
    if (isFirebaseConnected && db) {
        await db.collection('products').doc(id).delete();
    } else {
        let data = JSON.parse(fs.readFileSync(productsMockPath, 'utf8'));
        data = data.filter(item => item.id !== id);
        fs.writeFileSync(productsMockPath, JSON.stringify(data, null, 2));
    }
}

// Purchases DB Helper Functions (dual Firestore/Mock DB setup)
const purchasesMockPath = isVercel ? path.join(os.tmpdir(), 'db_purchases_mock.json') : path.join(__dirname, 'db_purchases_mock.json');
if (!fs.existsSync(purchasesMockPath)) {
    fs.writeFileSync(purchasesMockPath, JSON.stringify([], null, 2));
}

async function savePurchase(purchase) {
    if (isFirebaseConnected && db) {
        await db.collection('purchases').doc(purchase.id).set(purchase, { merge: true });
    } else {
        const data = JSON.parse(fs.readFileSync(purchasesMockPath, 'utf8'));
        const index = data.findIndex(item => item.id === purchase.id);
        if (index > -1) {
            data[index] = { ...data[index], ...purchase };
        } else {
            data.push(purchase);
        }
        fs.writeFileSync(purchasesMockPath, JSON.stringify(data, null, 2));
    }
}

async function getPurchasesByTicketId(ticketId) {
    if (isFirebaseConnected && db) {
        const snapshot = await db.collection('purchases').where('ticketId', '==', ticketId).get();
        const list = [];
        snapshot.forEach(doc => list.push(doc.data()));
        return list;
    } else {
        const data = JSON.parse(fs.readFileSync(purchasesMockPath, 'utf8'));
        return data.filter(item => item.ticketId === ticketId);
    }
}

async function checkPurchaseExists(ticketId, productId) {
    if (isFirebaseConnected && db) {
        const snapshot = await db.collection('purchases')
            .where('ticketId', '==', ticketId)
            .where('productId', '==', productId)
            .limit(1)
            .get();
        return !snapshot.empty;
    } else {
        const data = JSON.parse(fs.readFileSync(purchasesMockPath, 'utf8'));
        return data.some(item => item.ticketId === ticketId && item.productId === productId);
    }
}

async function getAllPurchases() {
    if (isFirebaseConnected && db) {
        const snapshot = await db.collection('purchases').get();
        const list = [];
        snapshot.forEach(doc => list.push(doc.data()));
        return list;
    } else {
        return JSON.parse(fs.readFileSync(purchasesMockPath, 'utf8'));
    }
}

// Asynchronous background email dispatcher loop
async function dispatchAnnouncementEmails(announcement, targets) {
    if (!process.env.EMAIL_USER || process.env.EMAIL_USER.includes('your_email')) {
        console.log(`✉ Email blast skipped: SMTP user credentials not configured.`);
        return;
    }

    console.log(`📢 Dispatching background email blast for notice "${announcement.title}" to ${targets.length} recipients...`);

    const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    let sentCount = 0;
    for (let attendee of targets) {
        try {
            const mailOptions = {
                from: `"Tbose Tutors Ibadan" <${process.env.EMAIL_USER}>`,
                to: attendee.email,
                subject: `Announcement: ${announcement.title}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #15172B; line-height: 1.6;">
                        <h2 style="color: #1B1F8A;">Hello ${attendee.fullName},</h2>
                        <p>We have an important update regarding your coaching prep at <strong>Tbose Tutors</strong>:</p>
                        
                        <div style="background-color: #E9EAEE; padding: 20px; border-left: 4px solid #00AEEF; border-radius: 4px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #1B1F8A;">${announcement.title}</h3>
                            <p style="white-space: pre-wrap;">${announcement.content}</p>
                        </div>
                        
                        <p>You can also log into your <a href="${appUrl}/portal" style="color: #00AEEF; font-weight: bold; text-decoration: none;">Student Portal</a> using your Ticket ID: <strong>${attendee.ticketId}</strong> to verify updates or review your class schedules.</p>
                        
                        <br>
                        <p>Best Regards,</p>
                        <strong>Tunde Bose</strong><br>
                        <span>Founder, Tbose Tutors Ibadan</span>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log(`✉ Notice email successfully sent to: ${attendee.email}`);
            
            sentCount++;
            await saveAnnouncement({
                id: announcement.id,
                emailsSent: sentCount
            });

            // Brief 200ms throttle delay
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
            console.error(`❌ Failed to send announcement email to ${attendee.email}:`, err.message);
        }
    }

    await saveAnnouncement({
        id: announcement.id,
        emailStatus: 'completed'
    });
    console.log(`✔ Finished email blast dispatch for notice: "${announcement.title}"`);
}

// ----------------------------------------------------
// 2. HELPER: Generate PDF Ticket (Stage 4 preview)
// ----------------------------------------------------
async function generateTicketPDF(attendee, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A6', margin: 15 });
            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            // Background Color (Deep Brand Blue: #1B1F8A)
            doc.rect(0, 0, doc.page.width, doc.page.height).fill('#1B1F8A');

            // Header Elements
            doc.fillColor('#00AEEF') // Electric Cyan
               .font('Helvetica-Bold')
               .fontSize(16)
               .text('TBOSE TUTORS', 15, 20, { align: 'center', characterSpacing: 1 });

            doc.fillColor('#FFFFFF')
               .font('Helvetica')
               .fontSize(9)
               .text('UTME & Post-UTME Coaching Prep', 15, 38, { align: 'center' });

            // Divider Line
            doc.strokeColor('#C7CBD6').lineWidth(1).moveTo(15, 50).lineTo(doc.page.width - 15, 50).stroke();

            // Attendee Details
            doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11).text('ATTENDEE PASS', 15, 60);

            doc.fillColor('#E9EAEE').font('Helvetica').fontSize(9);
            doc.text('Name:', 15, 78);
            doc.fillColor('#FFFFFF').font('Helvetica-Bold').text(attendee.fullName, 60, 78);

            doc.fillColor('#E9EAEE').font('Helvetica').text('Phone:', 15, 93);
            doc.fillColor('#FFFFFF').text(attendee.phone, 60, 93);

            doc.fillColor('#E9EAEE').font('Helvetica').text('Mode:', 15, 108);
            doc.fillColor('#00AEEF').font('Helvetica-Bold').text(attendee.attendanceMode.toUpperCase(), 60, 108);

            doc.fillColor('#E9EAEE').font('Helvetica').text('Payment:', 15, 123);
            doc.fillColor('#FFFFFF').text(`${attendee.paymentType.toUpperCase()} (Paid: ₦${attendee.amountPaid.toLocaleString()})`, 60, 123);

            if (attendee.balance > 0) {
                doc.fillColor('#E9EAEE').font('Helvetica').text('Balance:', 15, 138);
                doc.fillColor('#DC2626').font('Helvetica-Bold').text(`₦${attendee.balance.toLocaleString()}`, 60, 138);
            }

            // Location & Date Info
            doc.strokeColor('#C7CBD6').lineWidth(0.5).moveTo(15, 155).lineTo(doc.page.width - 15, 155).stroke();
            doc.fillColor('#E9EAEE').font('Helvetica').fontSize(8);
            doc.text('Start Date: May 27th', 15, 162);
            doc.text('Venue: Ibadan Center / WhatsApp Groups', 15, 172);

            // Status Stamp Banner
            const hasBalance = attendee.balance > 0;
            const statusColor = hasBalance ? '#DC2626' : '#16A34A';
            const statusText = hasBalance ? 'INSTALLMENT PASS - BALANCE DUE' : 'FULL ACCESS PASS - PAID';
            
            doc.rect(15, doc.page.height - 70, doc.page.width - 30, 20).fill(statusColor);
            doc.fillColor('#FFFFFF')
               .font('Helvetica-Bold')
               .fontSize(8)
               .text(statusText, 15, doc.page.height - 64, { align: 'center' });

            // Ticket ID Badge
            doc.rect(15, doc.page.height - 40, doc.page.width - 30, 25).fill('#10145C');
            doc.fillColor('#00AEEF')
               .font('Helvetica-Bold')
               .fontSize(12)
               .text(attendee.ticketId, 15, doc.page.height - 33, { align: 'center', characterSpacing: 1.5 });

            doc.end();
            stream.on('finish', () => resolve(outputPath));
            stream.on('error', (err) => reject(err));
        } catch (err) {
            reject(err);
        }
    });
}

// Helper: Generate Product Purchase Receipt PDF
async function generateReceiptPDF(purchase, student, product, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A6', margin: 15 });
            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            // Light Background
            doc.rect(0, 0, doc.page.width, doc.page.height).fill('#F3F4F6');

            // Header Banner (Navy Background)
            doc.rect(0, 0, doc.page.width, 45).fill('#10145C');

            // Header Title
            doc.fillColor('#00AEEF') // Cyan Accent
               .font('Helvetica-Bold')
               .fontSize(12)
               .text('TBOSE TUTORS', 15, 12, { align: 'center', characterSpacing: 1 });

            doc.fillColor('#FFFFFF')
               .font('Helvetica')
               .fontSize(8)
               .text('OFFICIAL PURCHASE RECEIPT', 15, 26, { align: 'center' });

            // Receipt Metadata Info
            doc.fillColor('#15172B').font('Helvetica-Bold').fontSize(9).text('TRANSACTION RECEIPT', 15, 55);

            // Divider Line
            doc.strokeColor('#C7CBD6').lineWidth(0.5).moveTo(15, 68).lineTo(doc.page.width - 15, 68).stroke();

            let y = 75;
            const drawRow = (label, val, highlightColor = '#15172B') => {
                doc.fillColor('#5F6475').font('Helvetica').fontSize(8).text(label, 15, y);
                doc.fillColor(highlightColor).font('Helvetica-Bold').fontSize(8).text(val, 75, y, { width: doc.page.width - 90, align: 'right' });
                y += 14;
            };

            drawRow('Receipt ID:', purchase.id);
            drawRow('Student Name:', student.fullName);
            drawRow('Ticket ID:', student.ticketId);
            drawRow('Date Paid:', new Date(purchase.purchasedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }));
            drawRow('Payment Ref:', purchase.reference);

            // Divider Line
            doc.strokeColor('#C7CBD6').lineWidth(0.5).moveTo(15, y + 4).lineTo(doc.page.width - 15, y + 4).stroke();
            y += 10;

            doc.fillColor('#15172B').font('Helvetica-Bold').fontSize(9).text('ITEMS PURCHASED', 15, y);
            y += 14;

            // Product Details Block
            doc.rect(15, y, doc.page.width - 30, 42).fill('#E9EAEE');
            doc.fillColor('#1B1F8A').font('Helvetica-Bold').fontSize(8.5).text(product.title, 20, y + 6);
            doc.fillColor('#5F6475').font('Helvetica').fontSize(7.5).text(`Type: ${product.type.toUpperCase()} (${product.deliveryMode.toUpperCase()})`, 20, y + 18);
            doc.fillColor('#16A34A').font('Helvetica-Bold').fontSize(9).text(`₦${parseFloat(purchase.pricePaid).toLocaleString()}`, 20, y + 28, { align: 'right', width: doc.page.width - 55 });
            y += 48;

            // Status Stamp Banner
            const isPhysical = product.deliveryMode === 'physical';
            const statusColor = '#16A34A';
            const statusText = 'TRANSACTION COMPLETED - PAID';
            
            doc.rect(15, y, doc.page.width - 30, 20).fill(statusColor);
            doc.fillColor('#FFFFFF')
               .font('Helvetica-Bold')
               .fontSize(7.5)
               .text(statusText, 15, y + 6, { align: 'center' });
            y += 24;

            // Delivery Note / Instructions
            doc.fillColor('#5F6475').font('Helvetica-Oblique').fontSize(7);
            if (isPhysical) {
                doc.text('* Present this receipt at the Ibadan Center to collect your physical material.', 15, y, { align: 'center', width: doc.page.width - 30 });
            } else {
                doc.text('* Download your digital materials directly from your Student Portal.', 15, y, { align: 'center', width: doc.page.width - 30 });
            }

            doc.end();
            stream.on('finish', () => resolve(outputPath));
            stream.on('error', (err) => reject(err));
        } catch (err) {
            reject(err);
        }
    });
}

async function generateTuitionReceiptPDF(student, monthKey, ledger, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A6', margin: 15 });
            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            // Light Background
            doc.rect(0, 0, doc.page.width, doc.page.height).fill('#F3F4F6');

            // Header Banner (Navy Background)
            doc.rect(0, 0, doc.page.width, 45).fill('#10145C');

            // Header Title
            doc.fillColor('#00AEEF') // Cyan Accent
               .font('Helvetica-Bold')
               .fontSize(12)
               .text('TBOSE TUTORS', 15, 12, { align: 'center', characterSpacing: 1 });

            doc.fillColor('#FFFFFF')
               .font('Helvetica')
               .fontSize(8)
               .text('TUITION PAYMENT RECEIPT', 15, 26, { align: 'center' });

            // Receipt Metadata Info
            doc.fillColor('#15172B').font('Helvetica-Bold').fontSize(9).text('TRANSACTION RECEIPT', 15, 55);

            // Divider Line
            doc.strokeColor('#C7CBD6').lineWidth(0.5).moveTo(15, 68).lineTo(doc.page.width - 15, 68).stroke();

            let y = 75;
            const drawRow = (label, val, highlightColor = '#15172B') => {
                doc.fillColor('#5F6475').font('Helvetica').fontSize(8).text(label, 15, y);
                doc.fillColor(highlightColor).font('Helvetica-Bold').fontSize(8).text(val, 75, y, { width: doc.page.width - 90, align: 'right' });
                y += 14;
            };

            const isFull = ledger.status === 'paid';
            const receiptId = `TR-${student.ticketId}-${monthKey.toUpperCase()}`;
            drawRow('Receipt ID:', receiptId);
            drawRow('Student Name:', student.fullName);
            drawRow('Ticket ID:', student.ticketId);
            drawRow('Date Issued:', new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }));
            drawRow('Payment Ref:', ledger.lastPaymentRef || 'N/A');

            // Stamp mark on the right side
            const stampColor = isFull ? '#16A34A' : '#D97706';
            const stampText = isFull ? 'PAID' : 'PART PAID';
            
            doc.save();
            doc.translate(doc.page.width - 85, 65);
            doc.rotate(-15); // Slant it slightly
            doc.strokeColor(stampColor).lineWidth(1.5).rect(0, 0, 70, 20).stroke();
            doc.fillColor(stampColor).font('Helvetica-Bold').fontSize(8).text(stampText, 0, 6, { width: 70, align: 'center' });
            doc.restore();

            // Divider Line
            doc.strokeColor('#C7CBD6').lineWidth(0.5).moveTo(15, y + 4).lineTo(doc.page.width - 15, y + 4).stroke();
            y += 10;

            doc.fillColor('#15172B').font('Helvetica-Bold').fontSize(9).text('TUITION FEES LEDGER', 15, y);
            y += 14;

            // Tuition Details Block
            doc.rect(15, y, doc.page.width - 30, 42).fill('#E9EAEE');
            
            const monthNames = {
                'month_1': 'Month 1 Tuition',
                'month_2': 'Month 2 Tuition'
            };
            const monthTitle = monthNames[monthKey] || `${monthKey.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} Tuition`;

            doc.fillColor('#1B1F8A').font('Helvetica-Bold').fontSize(8.5).text(monthTitle, 20, y + 6);
            doc.fillColor('#5F6475').font('Helvetica').fontSize(7.5).text(`Status: ${ledger.status.toUpperCase()}`, 20, y + 18);
            doc.fillColor('#5F6475').font('Helvetica').fontSize(7.5).text(`Outstanding Balance: ₦${parseFloat(ledger.balance).toLocaleString()}`, 20, y + 28);
            doc.fillColor('#16A34A').font('Helvetica-Bold').fontSize(9).text(`₦${parseFloat(ledger.amountPaid).toLocaleString()}`, 20, y + 28, { align: 'right', width: doc.page.width - 55 });
            y += 48;

            // Status Stamp Banner
            const statusColor = isFull ? '#16A34A' : '#D97706';
            const statusText = isFull ? 'TUITION PAYMENT - COMPLETED' : 'TUITION PAYMENT - INSTALLMENT / PARTIAL';
            
            doc.rect(15, y, doc.page.width - 30, 20).fill(statusColor);
            doc.fillColor('#FFFFFF')
               .font('Helvetica-Bold')
               .fontSize(7.5)
               .text(statusText, 15, y + 6, { align: 'center' });
            y += 24;

            // Notes
            doc.fillColor('#5F6475').font('Helvetica-Oblique').fontSize(7);
            doc.text('* This is an official receipt of payment for TBOSE UTME/Post-UTME prep portal.', 15, y, { align: 'center', width: doc.page.width - 30 });

            doc.end();
            stream.on('finish', () => resolve(outputPath));
            stream.on('error', (err) => reject(err));
        } catch (err) {
            reject(err);
        }
    });
}

// ----------------------------------------------------
// 3. HELPER: Send Ticket Email
// ----------------------------------------------------
async function sendTicketEmail(attendee, pdfPath) {
    if (!process.env.EMAIL_USER || process.env.EMAIL_USER.includes('your_email')) {
        console.log(`✉ Email sending skipped: SMTP user credentials not configured.`);
        return;
    }

    const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: `"Tbose Tutors Ibadan" <${process.env.EMAIL_USER}>`,
        to: attendee.email,
        subject: `Your Registration Pass - Tbose Tutors UTME/Post-UTME Classes`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; color: #15172B; line-height: 1.6;">
                <h2 style="color: #1B1F8A;">Hello ${attendee.fullName},</h2>
                <p>Congratulations! Your registration for <strong>Tbose Tutors UTME & Post-UTME Preparatory Classes</strong> has been confirmed.</p>
                <p>We are excited to support you on your journey to scoring 300+ in UTME and gaining admission to your dream university!</p>
                
                <div style="background-color: #E9EAEE; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1B1F8A;">Registration Details:</h3>
                    <ul style="list-style-type: none; padding: 0;">
                        <li><strong>Ticket ID:</strong> <span style="font-family: monospace; font-size: 1.1em; color: #00AEEF; font-weight: bold;">${attendee.ticketId}</span></li>
                        <li><strong>Attendance Mode:</strong> ${attendee.attendanceMode === 'online' ? 'Online Classes (WhatsApp Group)' : 'Physical Classes (Ibadan Center)'}</li>
                        <li><strong>Tuition Plan:</strong> ${attendee.paymentType === 'full' ? 'Full Payment' : 'Part Payment / Installment'}</li>
                        <li><strong>Amount Paid:</strong> ₦${attendee.amountPaid.toLocaleString()}</li>
                        <li><strong>Balance Owed:</strong> ₦${attendee.balance.toLocaleString()}</li>
                    </ul>
                </div>
                
                ${attendee.attendanceMode === 'online' && attendee.balance === 0 ? `
                <div style="margin: 20px 0;">
                    <p>Since you completed full payment, you can join the WhatsApp study group immediately using the link below:</p>
                    <p><a href="https://chat.whatsapp.com/mockGroupInviteTbosetutors" style="background-color: #16A34A; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">Join WhatsApp Class Group</a></p>
                </div>
                ` : ''}

                ${attendee.balance > 0 ? `
                <p style="color: #DC2626; font-weight: bold;">Reminder: Your balance of ₦${attendee.balance.toLocaleString()} must be cleared to attend classes.</p>
                ` : ''}
                
                <p>Please find your digital ticket PDF pass attached to this email. Present it at the entrance (for physical attendees) or for validation.</p>
                
                <br>
                <p>Best Regards,</p>
                <strong>Tunde Bose</strong><br>
                <span>Founder, Tbose Tutors Ibadan</span>
            </div>
        `,
        attachments: [
            {
                filename: `${attendee.ticketId}.pdf`,
                path: pdfPath
            }
        ]
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✉ Email successfully sent to ${attendee.email}`);
    } catch (err) {
        console.error(`❌ SMTP Email send error:`, err.message);
    }
}

// ----------------------------------------------------
// 4. API ENDPOINTS
// ----------------------------------------------------

// Endpoint: Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        database: isFirebaseConnected ? 'Firebase Firestore' : 'Local Mock FileDB'
    });
});

// Endpoint: Public Configuration (exposing Paystack public key)
app.get('/api/config', (req, res) => {
    res.json({
        paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_a0d5c074ea28b43ab2c40c34deccb45d064fb9b6'
    });
});

// Endpoint: Verify payment & finalize registration
app.post('/api/verify-payment', async (req, res) => {
    const { reference, email, fullName, phone, attendanceMode, paymentPlan } = req.body;

    if (!reference || !email || !fullName || !phone || !attendanceMode || !paymentPlan) {
        return res.status(400).json({ error: 'Missing required registration details.' });
    }

    try {
        let isPaymentValid = false;
        let amountPaidNaira = 0;

        // Skip paystack request if using mock secret key (helps testing without internet API keys)
        const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
        if (secretKey.startsWith('sk_test_mock_key') || reference.startsWith('mock_ref')) {
            console.log(`ℹ Simulating Paystack transaction verification for: ${reference}`);
            isPaymentValid = true;
            amountPaidNaira = paymentPlan === 'full' ? 25000 : 12500;
        } else {
            // Verify payment with Paystack API
            const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
                headers: {
                    Authorization: `Bearer ${secretKey}`
                }
            });

            if (response.data && response.data.status && response.data.data.status === 'success') {
                isPaymentValid = true;
                // Paystack returns amount in kobo
                amountPaidNaira = response.data.data.amount / 100;
            }
        }

        if (!isPaymentValid) {
            return res.status(400).json({ error: 'Paystack payment verification failed.' });
        }

        // Expected amount validation
        const expectedAmount = paymentPlan === 'full' ? 25000 : 12500;
        if (amountPaidNaira < expectedAmount) {
            return res.status(400).json({ error: `Insufficient amount paid. Expected at least ₦${expectedAmount.toLocaleString()}, received ₦${amountPaidNaira.toLocaleString()}` });
        }

        // Generate Ticket details
        const ticketId = 'TKT-' + Math.floor(100000 + Math.random() * 900000);
        const tuitionBalance = paymentPlan === 'full' ? 0 : 12500;

        const attendeeRecord = {
            id: ticketId, // primary document ID
            fullName: fullName.trim(),
            phone: phone.trim(),
            email: email.trim().toLowerCase(),
            attendanceMode,
            paymentType: paymentPlan,
            amountPaid: amountPaidNaira,
            balance: tuitionBalance,
            ticketId,
            paystackRef: reference,
            paymentStatus: 'confirmed',
            registeredAt: new Date().toISOString(),
            lessonId: 'utme_postutme_2026'
        };

        // 1. Save to Database
        await saveAttendee(attendeeRecord);

        // 2. Generate PDF Ticket
        const pdfFileName = `${ticketId}.pdf`;
        const pdfPath = path.join(ticketsDir, pdfFileName);
        await generateTicketPDF(attendeeRecord, pdfPath);

        // 3. Send Email Notification
        await sendTicketEmail(attendeeRecord, pdfPath);

        // 4. Return success details to frontend
        return res.status(200).json({
            success: true,
            ticketId,
            fullName: attendeeRecord.fullName,
            attendanceMode,
            paymentType: paymentPlan,
            amountPaid: amountPaidNaira,
            balance: tuitionBalance,
            downloadUrl: `/tickets/${pdfFileName}`
        });

    } catch (error) {
        console.error('API Verification error:', error.message);
        return res.status(500).json({ error: 'Internal server error verifying transaction.' });
    }
});

// Endpoint: Download Tickets routing (with automatic dynamic regeneration fallback)
app.get('/tickets/:fileName', async (req, res) => {
    const fileName = req.params.fileName;
    const ticketId = fileName.replace('.pdf', '').toUpperCase();
    const filePath = path.join(ticketsDir, fileName);

    if (fs.existsSync(filePath)) {
        return res.download(filePath);
    }

    try {
        // Fallback: If ticket was deleted or server restarted on ephemeral hosting, regenerate it
        const attendee = await getAttendeeByTicketId(ticketId);
        if (attendee) {
            console.log(`ℹ PDF ticket missing on disk. Regenerating ticket pass for: ${ticketId}`);
            await generateTicketPDF(attendee, filePath);
            return res.download(filePath);
        }
    } catch (err) {
        console.error('Failed to regenerate missing PDF ticket pass:', err.message);
    }

    res.status(404).send('Ticket file not found or could not be generated.');
});

// Endpoint: Admin fetch all registrations (secured by simple password)
app.get('/api/attendees', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (!authHeader || authHeader !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
    }

    try {
        const list = await getAllAttendees();
        return res.json(list);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database retrieval error.' });
    }
});

// Endpoint: Scan / Verify a ticket at the door (Secured)
app.post('/api/verify-ticket', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (!authHeader || authHeader !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { ticketId } = req.body;
    if (!ticketId) {
        return res.status(400).json({ error: 'Missing ticket ID.' });
    }

    try {
        const attendee = await getAttendeeByTicketId(ticketId);
        if (!attendee) {
            return res.json({ valid: false, message: 'TICKET NOT FOUND' });
        }

        // Return details and highlights balance checks
        return res.json({
            valid: true,
            fullName: attendee.fullName,
            attendanceMode: attendee.attendanceMode,
            paymentType: attendee.paymentType,
            amountPaid: attendee.amountPaid,
            balance: attendee.balance,
            registeredAt: attendee.registeredAt
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database check error.' });
    }
});

// Endpoint: Public Portal search by Ticket ID
app.get('/api/portal/:ticketId', async (req, res) => {
    const { ticketId } = req.params;
    try {
        const attendee = await getAttendeeByTicketId(ticketId.trim().toUpperCase());
        if (!attendee) {
            return res.status(404).json({ error: 'Ticket ID not found.' });
        }

        // Return a ledger mapping to handle monthly cycles
        const tuitionMonths = attendee.tuitionMonths || {
            "month_1": {
                "status": attendee.balance > 0 ? "part" : "paid",
                "amountPaid": attendee.amountPaid,
                "balance": attendee.balance,
                "lastPaymentRef": attendee.paystackRef
            },
            "month_2": {
                "status": "unpaid",
                "amountPaid": 0,
                "balance": 25000,
                "lastPaymentRef": ""
            }
        };

        return res.json({
            ticketId: attendee.ticketId,
            fullName: attendee.fullName,
            email: attendee.email,
            phone: attendee.phone,
            attendanceMode: attendee.attendanceMode,
            tuitionMonths
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Portal query error.' });
    }
});

// Endpoint: Process balance or subsequent monthly tuition payments via Paystack
app.post('/api/pay-balance', async (req, res) => {
    const { reference, ticketId, monthKey, paymentPlan } = req.body;

    if (!reference || !ticketId || !monthKey || !paymentPlan) {
        return res.status(400).json({ error: 'Missing payment details.' });
    }

    try {
        const attendee = await getAttendeeByTicketId(ticketId.trim().toUpperCase());
        if (!attendee) {
            return res.status(404).json({ error: 'Attendee account not found.' });
        }

        // Initialize ledger if it doesn't exist
        if (!attendee.tuitionMonths) {
            attendee.tuitionMonths = {
                "month_1": {
                    "status": attendee.balance > 0 ? "part" : "paid",
                    "amountPaid": attendee.amountPaid,
                    "balance": attendee.balance,
                    "lastPaymentRef": attendee.paystackRef
                },
                "month_2": {
                    "status": "unpaid",
                    "amountPaid": 0,
                    "balance": 25000,
                    "lastPaymentRef": ""
                }
            };
        }

        let isPaymentValid = false;
        let amountPaidNaira = 0;

        const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
        if (secretKey.startsWith('sk_test_mock_key') || reference.startsWith('mock_ref')) {
            isPaymentValid = true;
            if (monthKey === 'month_1') {
                amountPaidNaira = 12500;
            } else {
                amountPaidNaira = paymentPlan === 'full' ? 25000 : 12500;
            }
        } else {
            const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
                headers: { Authorization: `Bearer ${secretKey}` }
            });

            if (response.data && response.data.status && response.data.data.status === 'success') {
                isPaymentValid = true;
                amountPaidNaira = response.data.data.amount / 100;
            }
        }

        if (!isPaymentValid) {
            return res.status(400).json({ error: 'Paystack transaction verification failed.' });
        }

        const monthLedger = attendee.tuitionMonths[monthKey] || { status: 'unpaid', amountPaid: 0, balance: 25000, lastPaymentRef: '' };
        
        if (monthKey === 'month_1' && monthLedger.status === 'part') {
            monthLedger.amountPaid += amountPaidNaira;
            monthLedger.balance = Math.max(0, monthLedger.balance - amountPaidNaira);
            monthLedger.status = monthLedger.balance === 0 ? 'paid' : 'part';
            monthLedger.lastPaymentRef = reference;
        } else {
            monthLedger.amountPaid = amountPaidNaira;
            monthLedger.balance = paymentPlan === 'full' ? 0 : 12500;
            monthLedger.status = paymentPlan === 'full' ? 'paid' : 'part';
            monthLedger.lastPaymentRef = reference;
        }

        attendee.tuitionMonths[monthKey] = monthLedger;
        
        // Sync global values with the Month 1 balance
        attendee.balance = attendee.tuitionMonths.month_1.balance;
        attendee.amountPaid = attendee.tuitionMonths.month_1.amountPaid;
        attendee.paymentType = attendee.tuitionMonths.month_1.status === 'paid' ? 'full' : 'part';

        // Save back to DB
        await saveAttendee(attendee);

        // Regenerate PDF Ticket
        const pdfFileName = `${ticketId}.pdf`;
        const pdfPath = path.join(ticketsDir, pdfFileName);
        await generateTicketPDF(attendee, pdfPath);

        // Re-email updated ticket
        await sendTicketEmail(attendee, pdfPath);

        return res.json({
            success: true,
            ticketId,
            tuitionMonths: attendee.tuitionMonths,
            downloadUrl: `/tickets/${pdfFileName}`
        });

    } catch (error) {
        console.error('API pay-balance verification error:', error.message);
        return res.status(500).json({ error: 'Internal server error processing payment.' });
    }
});

// ----------------------------------------------------
// 5. FILE UPLOAD & RESOURCES API ENDPOINTS
// ----------------------------------------------------

// Endpoint: Fetch resources (accessible by students)
app.get('/api/resources', async (req, res) => {
    try {
        const resources = await getAllResources();
        return res.json(resources);
    } catch (err) {
        console.error('Failed to get resources:', err.message);
        return res.status(500).json({ error: 'Database retrieval error.' });
    }
});

// Endpoint: Admin Upload resource file
app.post('/api/admin/upload', upload.single('file'), async (req, res) => {
    const authHeader = req.headers['authorization'];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (!authHeader || authHeader !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { title, category } = req.body;
    if (!title || !category) {
        // Clean up uploaded file if fields are missing
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ error: 'Missing title or category parameters.' });
    }

    try {
        const id = 'res_' + Math.floor(100000 + Math.random() * 900000);
        const fileSizeNBytes = req.file.size;
        
        // Format size
        let fileSizeStr = `${(fileSizeNBytes / 1024).toFixed(1)} KB`;
        if (fileSizeNBytes > 1024 * 1024) {
            fileSizeStr = `${(fileSizeNBytes / (1024 * 1024)).toFixed(1)} MB`;
        }

        const resourceRecord = {
            id,
            title: title.trim(),
            fileName: req.file.filename,
            fileSize: fileSizeStr,
            category,
            uploadedAt: new Date().toISOString()
        };

        await saveResource(resourceRecord);
        return res.status(200).json({ success: true, resource: resourceRecord });
    } catch (err) {
        console.error('File upload save error:', err.message);
        // Clean up file if DB save fails
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({ error: 'Database save error.' });
    }
});

// Endpoint: Admin Delete resource file
app.delete('/api/admin/resources/:id', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (!authHeader || authHeader !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
    }

    const { id } = req.params;
    try {
        const resource = await getResourceById(id);
        if (!resource) {
            return res.status(404).json({ error: 'Resource not found.' });
        }

        // 1. Remove file from disk
        const filePath = path.join(uploadDir, resource.fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // 2. Remove from database
        await deleteResourceFromDb(id);

        return res.json({ success: true, message: 'Resource successfully deleted.' });
    } catch (err) {
        console.error('Delete resource error:', err.message);
        return res.status(500).json({ error: 'Failed to delete resource.' });
    }
});

// ----------------------------------------------------
// 6. ANNOUNCEMENTS & EMAIL BLAST API ENDPOINTS
// ----------------------------------------------------

// Endpoint: Fetch all announcements (admin history list)
app.get('/api/admin/announcements', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (!authHeader || authHeader !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
    }

    try {
        const notices = await getAllAnnouncements();
        return res.json(notices);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to retrieve announcements.' });
    }
});

// Endpoint: Create a new announcement & trigger background email loop
app.post('/api/admin/announcements', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (!authHeader || authHeader !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
    }

    const { title, content, targetGroup, sendEmail } = req.body;
    if (!title || !content || !targetGroup) {
        return res.status(400).json({ error: 'Missing required parameters.' });
    }

    try {
        const id = 'ann_' + Math.floor(100000 + Math.random() * 900000);
        const announcementRecord = {
            id,
            title: title.trim(),
            content: content.trim(),
            targetGroup,
            sendEmail: !!sendEmail,
            emailStatus: sendEmail ? 'pending' : 'none',
            emailsSent: 0,
            emailsTotal: 0,
            sentAt: new Date().toISOString()
        };

        // If email blast is checked, schedule in background and pre-calculate totals
        if (sendEmail) {
            const attendees = await getAllAttendees();
            let targets = [];

            if (targetGroup === 'all') {
                targets = attendees;
            } else if (targetGroup === 'physical') {
                targets = attendees.filter(a => a.attendanceMode === 'physical');
            } else if (targetGroup === 'online') {
                targets = attendees.filter(a => a.attendanceMode === 'online');
            } else if (targetGroup === 'balance_due') {
                targets = attendees.filter(a => a.balance > 0);
            }

            announcementRecord.emailStatus = targets.length > 0 ? 'sending' : 'completed';
            announcementRecord.emailsTotal = targets.length;

            // 1. Save to Database with total counts
            await saveAnnouncement(announcementRecord);

            // Trigger background dispatch (async)
            dispatchAnnouncementEmails(announcementRecord, targets);
        } else {
            // 1. Save to Database
            await saveAnnouncement(announcementRecord);
        }

        return res.status(200).json({ success: true, announcement: announcementRecord });

    } catch (err) {
        console.error('Announcements save error:', err.message);
        return res.status(500).json({ error: 'Database save error.' });
    }
});

// Endpoint: Delete an announcement
app.delete('/api/admin/announcements/:id', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (!authHeader || authHeader !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
    }

    const { id } = req.params;
    try {
        await deleteAnnouncementFromDb(id);
        return res.json({ success: true, message: 'Announcement successfully deleted.' });
    } catch (err) {
        console.error('Delete announcement error:', err.message);
        return res.status(500).json({ error: 'Failed to delete announcement.' });
    }
});

// Endpoint: Fetch announcements targeted at a specific student's ticket ID
app.get('/api/announcements/:ticketId', async (req, res) => {
    const { ticketId } = req.params;
    try {
        const attendee = await getAttendeeByTicketId(ticketId.trim().toUpperCase());
        if (!attendee) {
            return res.status(404).json({ error: 'Ticket ID not found.' });
        }

        const allNotices = await getAllAnnouncements();

        // Filter notices matching student group criteria
        const filteredNotices = allNotices.filter(notice => {
            if (notice.targetGroup === 'all') return true;
            if (notice.targetGroup === attendee.attendanceMode) return true;
            if (notice.targetGroup === 'balance_due' && attendee.balance > 0) return true;
            return false;
        });

        return res.json(filteredNotices);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to retrieve announcements.' });
    }
});

// ----------------------------------------------------
// 7. STUDENT TOOLS (PRODUCTS & SECURE PURCHASES) API
// ----------------------------------------------------

// Endpoint: Admin Upload/Create a new paid product
app.post('/api/admin/products', secureUpload.single('file'), async (req, res) => {
    const authHeader = req.headers['authorization'];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (!authHeader || authHeader !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
    }

    const { title, description, type, price, deliveryMode } = req.body;
    if (!title || !description || !type || !price || !deliveryMode) {
        return res.status(400).json({ error: 'Missing required product parameters.' });
    }

    if (deliveryMode === 'digital' && !req.file) {
        return res.status(400).json({ error: 'Digital products require a file upload.' });
    }

    try {
        const id = 'prod_' + Math.floor(100000 + Math.random() * 900000);
        const parsedPrice = parseFloat(price);

        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({ error: 'Price must be a valid positive number.' });
        }

        let finalFileName = null;
        if (deliveryMode === 'digital' && req.file) {
            finalFileName = Date.now() + '-' + req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            
            if (isFirebaseConnected && db) {
                // Upload to Firebase Storage bucket
                const bucket = admin.storage().bucket();
                const fileRef = bucket.file(`secure_uploads/${finalFileName}`);
                await fileRef.save(req.file.buffer, {
                    metadata: { contentType: req.file.mimetype }
                });
            } else {
                // Local disk storage fallback
                const filePath = path.join(secureUploadDir, finalFileName);
                fs.writeFileSync(filePath, req.file.buffer);
            }
        }

        const productRecord = {
            id,
            title: title.trim(),
            description: description.trim(),
            type: type.trim(),
            deliveryMode: deliveryMode.trim(),
            price: parsedPrice,
            fileName: finalFileName,
            createdAt: new Date().toISOString()
        };

        await saveProduct(productRecord);
        return res.status(200).json({ success: true, product: productRecord });
    } catch (err) {
        console.error('Product save error:', err);
        return res.status(500).json({ error: `Product save error: ${err.message}` });
    }
});

// Endpoint: Fetch all products for student portal (fileName is excluded for security)
app.get('/api/products', async (req, res) => {
    try {
        const products = await getAllProducts();
        const safeProducts = products.map(({ fileName, ...rest }) => rest);
        return res.json(safeProducts);
    } catch (err) {
        console.error('Fetch products error:', err.message);
        return res.status(500).json({ error: 'Failed to retrieve products.' });
    }
});

// Endpoint: Fetch purchases made by a specific student ticket ID
app.get('/api/student/purchases', async (req, res) => {
    const { ticketId } = req.query;
    if (!ticketId) {
        return res.status(400).json({ error: 'Missing student ticketId.' });
    }

    try {
        const attendee = await getAttendeeByTicketId(ticketId.trim().toUpperCase());
        if (!attendee) {
            return res.status(404).json({ error: 'Student Ticket ID not found.' });
        }

        const purchases = await getPurchasesByTicketId(ticketId.trim().toUpperCase());
        return res.json(purchases);
    } catch (err) {
        console.error('Fetch purchases error:', err.message);
        return res.status(500).json({ error: 'Failed to retrieve purchases.' });
    }
});

// Endpoint: Record a mock purchase (Simulated payment confirmation)
app.post('/api/products/purchase', async (req, res) => {
    const { ticketId, productId, reference } = req.body;
    if (!ticketId || !productId || !reference) {
        return res.status(400).json({ error: 'Missing required purchase parameters.' });
    }

    try {
        const studentId = ticketId.trim().toUpperCase();
        // 1. Verify student exists
        const attendee = await getAttendeeByTicketId(studentId);
        if (!attendee) {
            return res.status(404).json({ error: 'Student Ticket ID not found.' });
        }

        // 2. Verify product exists
        const product = await getProductById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        // 3. Prevent duplicate purchase
        const alreadyPurchased = await checkPurchaseExists(studentId, productId);
        if (alreadyPurchased) {
            return res.status(400).json({ error: 'Product already purchased.' });
        }

        const purchaseRecord = {
            id: 'purch_' + Math.floor(100000 + Math.random() * 900000),
            ticketId: studentId,
            productId,
            reference,
            pricePaid: product.price,
            purchasedAt: new Date().toISOString(),
            status: 'completed'
        };

        await savePurchase(purchaseRecord);
        return res.json({ success: true, purchase: purchaseRecord });
    } catch (err) {
        console.error('Purchase confirmation error:', err.message);
        return res.status(500).json({ error: 'Failed to record purchase.' });
    }
});

// Endpoint: Download secure product files (Only after purchase verification)
app.get('/api/products/:id/download', async (req, res) => {
    const { id } = req.params;
    const { ticketId } = req.query;

    if (!ticketId) {
        return res.status(400).json({ error: 'Missing student ticketId.' });
    }

    try {
        const studentId = ticketId.trim().toUpperCase();
        // 1. Verify purchase exists
        const hasPaid = await checkPurchaseExists(studentId, id);
        if (!hasPaid) {
            return res.status(403).json({ error: 'Access denied. You have not purchased this item.' });
        }

        // 2. Locate product metadata to get actual file name
        const product = await getProductById(id);
        if (!product) {
            return res.status(404).json({ error: 'Product metadata not found.' });
        }

        if (product.deliveryMode === 'physical') {
            return res.status(400).json({ error: 'This is a physical product and cannot be downloaded.' });
        }

        if (!product.fileName) {
            return res.status(404).json({ error: 'Product file not found.' });
        }

        // 3. Serve file from Firebase Storage or Local Disk
        if (isFirebaseConnected && db) {
            const bucket = admin.storage().bucket();
            const fileRef = bucket.file(`secure_uploads/${product.fileName}`);
            const [exists] = await fileRef.exists();
            if (!exists) {
                return res.status(404).json({ error: 'Product file not found in storage.' });
            }

            const [metadata] = await fileRef.getMetadata();
            res.setHeader('Content-Disposition', `attachment; filename="${product.title}${path.extname(product.fileName)}"`);
            res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
            
            return fileRef.createReadStream().pipe(res);
        } else {
            const filePath = path.join(secureUploadDir, product.fileName);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Product file not found on server.' });
            }
            return res.download(filePath, product.title + path.extname(product.fileName));
        }
    } catch (err) {
        console.error('Download product error:', err.message);
        return res.status(500).json({ error: 'Failed to download product.' });
    }
});

// Endpoint: Download product purchase receipt PDF
app.get('/api/purchases/:id/receipt', async (req, res) => {
    const { id } = req.params;
    const { ticketId } = req.query;

    if (!ticketId) {
        return res.status(400).json({ error: 'Missing student ticketId.' });
    }

    try {
        const studentId = ticketId.trim().toUpperCase();
        // 1. Verify student exists
        const student = await getAttendeeByTicketId(studentId);
        if (!student) {
            return res.status(404).json({ error: 'Student Ticket ID not found.' });
        }

        // 2. Fetch purchase record
        let purchase = null;
        if (isFirebaseConnected && db) {
            const doc = await db.collection('purchases').doc(id).get();
            purchase = doc.exists ? doc.data() : null;
        } else {
            const data = JSON.parse(fs.readFileSync(purchasesMockPath, 'utf8'));
            purchase = data.find(item => item.id === id) || null;
        }

        if (!purchase) {
            return res.status(404).json({ error: 'Purchase record not found.' });
        }

        // 3. Verify purchase belongs to this student
        if (purchase.ticketId !== studentId) {
            return res.status(403).json({ error: 'Access denied. This receipt does not belong to you.' });
        }

        // 4. Get product details
        const product = await getProductById(purchase.productId);
        if (!product) {
            return res.status(404).json({ error: 'Associated product details not found.' });
        }

        // 5. Generate Receipt PDF
        const receiptFileName = `receipt-${purchase.id}.pdf`;
        const receiptPath = path.join(ticketsDir, receiptFileName);
        
        await generateReceiptPDF(purchase, student, product, receiptPath);

        // 6. Send file for download
        return res.download(receiptPath, `Receipt-${product.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch (err) {
        console.error('Download receipt error:', err.message);
        return res.status(500).json({ error: 'Failed to download receipt.' });
    }
});

// Endpoint: Download tuition payment receipt PDF
app.get('/api/tuition/receipt', async (req, res) => {
    const { ticketId, monthKey } = req.query;

    if (!ticketId || !monthKey) {
        return res.status(400).json({ error: 'Missing ticketId or monthKey.' });
    }

    try {
        const studentId = ticketId.trim().toUpperCase();
        // 1. Verify student exists
        const student = await getAttendeeByTicketId(studentId);
        if (!student) {
            return res.status(404).json({ error: 'Student Account not found.' });
        }

        // 2. Fetch ledger details
        const tuitionMonths = student.tuitionMonths || {
            "month_1": {
                "status": student.balance > 0 ? "part" : "paid",
                "amountPaid": student.amountPaid || 0,
                "balance": student.balance !== undefined ? student.balance : 0,
                "lastPaymentRef": student.paystackRef || ""
            },
            "month_2": {
                "status": "unpaid",
                "amountPaid": 0,
                "balance": 25000,
                "lastPaymentRef": ""
            }
        };

        const ledger = tuitionMonths[monthKey];
        if (!ledger) {
            return res.status(404).json({ error: 'Month ledger details not found.' });
        }

        if (ledger.status === 'unpaid' || parseFloat(ledger.amountPaid) === 0) {
            return res.status(400).json({ error: 'No tuition payment found for this month.' });
        }

        // 3. Generate Receipt PDF
        const receiptFileName = `tuition-receipt-${student.ticketId}-${monthKey}.pdf`;
        const receiptPath = path.join(ticketsDir, receiptFileName);

        await generateTuitionReceiptPDF(student, monthKey, ledger, receiptPath);

        // 4. Send file for download
        const readableMonth = monthKey.replace('_', ' ').toUpperCase();
        return res.download(receiptPath, `Tuition_Receipt_${readableMonth}_${student.ticketId}.pdf`);
    } catch (err) {
        console.error('Download tuition receipt error:', err.message);
        return res.status(500).json({ error: 'Failed to download tuition receipt.' });
    }
});

// Endpoint: Fetch admin analytics and statistics
app.get('/api/admin/analytics', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (!authHeader || authHeader !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
    }

    try {
        const attendees = await getAllAttendees();
        const purchases = await getAllPurchases();

        let totalTuitionCollected = 0;
        let totalOutstandingTuition = 0;
        let physicalStudentsCount = 0;
        let onlineStudentsCount = 0;

        attendees.forEach(student => {
            // Count student attendance mode
            if (student.attendanceMode === 'physical') {
                physicalStudentsCount++;
            } else {
                onlineStudentsCount++;
            }

            // Calculate tuition months ledger
            const tuitionMonths = student.tuitionMonths || {
                "month_1": {
                    "status": student.balance > 0 ? "part" : "paid",
                    "amountPaid": student.amountPaid || 0,
                    "balance": student.balance !== undefined ? student.balance : 0
                },
                "month_2": {
                    "status": "unpaid",
                    "amountPaid": 0,
                    "balance": 25000
                }
            };

            // Aggregate tuition amounts for all months
            Object.values(tuitionMonths).forEach(month => {
                totalTuitionCollected += parseFloat(month.amountPaid || 0);
                totalOutstandingTuition += parseFloat(month.balance || 0);
            });
        });

        // Sum up material sales revenue
        let totalMaterialSales = 0;
        purchases.forEach(purchase => {
            totalMaterialSales += parseFloat(purchase.pricePaid || 0);
        });

        return res.json({
            totalTuitionCollected,
            totalOutstandingTuition,
            totalMaterialSales,
            totalStudents: attendees.length,
            physicalStudents: physicalStudentsCount,
            onlineStudents: onlineStudentsCount
        });
    } catch (err) {
        console.error('Analytics aggregation error:', err.message);
        return res.status(500).json({ error: 'Failed to aggregate analytics data.' });
    }
});

// Endpoint: Admin Delete product
app.delete('/api/admin/products/:id', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (!authHeader || authHeader !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
    }

    const { id } = req.params;
    try {
        const product = await getProductById(id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        // Remove secure file from storage/disk if it exists (digital products)
        if (product.fileName) {
            if (isFirebaseConnected && db) {
                const bucket = admin.storage().bucket();
                const fileRef = bucket.file(`secure_uploads/${product.fileName}`);
                const [exists] = await fileRef.exists();
                if (exists) {
                    await fileRef.delete();
                }
            } else {
                const filePath = path.join(secureUploadDir, product.fileName);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }

        // Remove record from database
        await deleteProductFromDb(id);

        return res.json({ success: true, message: 'Product successfully deleted.' });
    } catch (err) {
        console.error('Delete product error:', err.message);
        return res.status(500).json({ error: 'Failed to delete product.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Tbose Tutors server running on http://localhost:${PORT}`);
    console.log(`📢 Staging database: ${isFirebaseConnected ? 'Firebase Active' : 'Local JSON DB'}`);
    console.log(`======================================================\n`);
});
