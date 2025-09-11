const { createClient } = require('@supabase/supabase-js');
const Busboy = require('busboy');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Helper to parse multipart/form-data
function parseMultipartForm(event) {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: event.headers });
        const fields = {};
        const files = [];

        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
            const filepath = path.join(os.tmpdir(), filename.filename);
            const writeStream = fs.createWriteStream(filepath);
            file.pipe(writeStream);

            files.push({
                fieldname,
                filename: filename.filename,
                encoding,
                mimetype,
                filepath
            });
        });

        busboy.on('field', (fieldname, val) => {
            fields[fieldname] = val;
        });

        busboy.on('finish', () => {
            resolve({ fields, files });
        });

        busboy.on('error', reject);

        busboy.end(Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8'));
    });
}

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { files, fields } = await parseMultipartForm(event);

        if (!files || files.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'No file uploaded' }) };
        }

        const file = files[0];
        const { anonymousChatId, clientId } = fields;

        if (!anonymousChatId && !clientId) {
            return { statusCode: 400, body: JSON.stringify({ error: 'anonymousChatId or clientId is required' }) };
        }

        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const bucketName = 'support_attachments';
        const filePath = `${clientId || anonymousChatId}/${Date.now()}-${file.filename}`;

        const fileBuffer = fs.readFileSync(file.filepath);

        const { data, error } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(filePath, fileBuffer, {
                contentType: file.mimetype,
                upsert: false
            });

        // Clean up the temporary file
        fs.unlinkSync(file.filepath);

        if (error) {
            console.error('Supabase upload error:', error);
            throw new Error('Failed to upload file to storage: ' + error.message);
        }

        const publicUrl = supabaseAdmin.storage.from(bucketName).getPublicUrl(data.path).data.publicUrl;

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'File uploaded successfully',
                publicUrl: publicUrl,
                fileType: file.mimetype
            })
        };

    } catch (e) {
        console.error('Handler Error:', e);
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
};
