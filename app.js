// Initialize global elements and states
const mainCanvas = document.getElementById('qr-canvas');
const tempCanvas = document.createElement('canvas');
const logoImg = new Image();

// Input elements
const qrFgColorInput = document.getElementById('qr-fg-color');
const qrFgHexInput = document.getElementById('qr-fg-hex');
const qrBgColorInput = document.getElementById('qr-bg-color');
const qrBgHexInput = document.getElementById('qr-bg-hex');
const qrGradStartInput = document.getElementById('qr-grad-start');
const qrGradStartHexInput = document.getElementById('qr-grad-start-hex');
const qrGradEndInput = document.getElementById('qr-grad-end');
const qrGradEndHexInput = document.getElementById('qr-grad-end-hex');
const qrGradDirSelect = document.getElementById('qr-grad-dir');

const qrSizeSelect = document.getElementById('qr-size');
const qrMarginSelect = document.getElementById('qr-margin');
const qrEccSelect = document.getElementById('qr-ecc');

const logoUploadInput = document.getElementById('logo-upload');
const logoPreviewImg = document.getElementById('logo-preview-img');
const logoPlaceholder = document.getElementById('logo-preview-placeholder');
const btnRemoveLogo = document.getElementById('btn-remove-logo');
const logoSizeRange = document.getElementById('logo-size');
const logoSizeVal = document.getElementById('logo-size-val');
const logoBorderCheckbox = document.getElementById('logo-border');

// Toast function
function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    toastMsg.textContent = message;
    
    toast.classList.remove('hidden');
    
    // Clear any previous timeout
    if (window.toastTimeout) {
        clearTimeout(window.toastTimeout);
    }
    
    window.toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Escape special characters for Wi-Fi strings
function escapeWifiString(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\')
              .replace(/;/g, '\\;')
              .replace(/:/g, '\\:')
              .replace(/,/g, '\\,')
              .replace(/"/g, '\\"');
}

// Convert local ISO datetime to vCalendar standard (YYYYMMDDTHHMMSS)
function formatVCalendarDate(dateTimeStr) {
    if (!dateTimeStr) return '';
    const clean = dateTimeStr.replace(/[-:]/g, ''); // Remove dashes and colons
    return clean + '00'; // Append seconds
}

// Synchronize Color Pickers and Hex Inputs
function syncColorPicker(pickerId, hexId) {
    const picker = document.getElementById(pickerId);
    const hex = document.getElementById(hexId);
    
    picker.addEventListener('input', function() {
        hex.value = picker.value.toUpperCase();
        generateQRCode();
    });
    
    hex.addEventListener('input', function() {
        let val = hex.value.trim();
        if (!val.startsWith('#')) {
            val = '#' + val;
        }
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            picker.value = val;
            generateQRCode();
        }
    });
}

// Helper to draw standard logo in the center of the QR canvas
function drawLogoOnCanvas(ctx, size) {
    const logoPercentage = parseInt(logoSizeRange.value) / 100;
    const logoSize = size * logoPercentage;
    const x = (size - logoSize) / 2;
    const y = (size - logoSize) / 2;
    
    // 1. Draw rounded border card
    if (logoBorderCheckbox.checked) {
        const padding = logoSize * 0.15;
        const r = logoSize * 0.1; // Border radius
        ctx.fillStyle = qrBgColorInput.value;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x - padding, y - padding, logoSize + padding * 2, logoSize + padding * 2, r);
        } else {
            ctx.rect(x - padding, y - padding, logoSize + padding * 2, logoSize + padding * 2);
        }
        ctx.fill();
    }
    
    // 2. Draw Logo Image
    ctx.drawImage(logoImg, x, y, logoSize, logoSize);
}

// Generate the data representation for QR Code based on active tab
function getQRData() {
    const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');
    
    switch (activeTab) {
        case 'url': {
            let url = document.getElementById('url-input').value.trim();
            if (!url) return '';
            if (!/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
            }
            return url;
        }
        case 'text': {
            return document.getElementById('text-input').value;
        }
        case 'wifi': {
            const ssid = document.getElementById('wifi-ssid').value.trim();
            const password = document.getElementById('wifi-password').value;
            const encryption = document.getElementById('wifi-encryption').value;
            const isHidden = document.getElementById('wifi-hidden').checked;
            
            if (!ssid) return '';
            
            let wifiStr = `WIFI:S:${escapeWifiString(ssid)};T:${encryption};`;
            if (encryption !== 'nopass' && password) {
                wifiStr += `P:${escapeWifiString(password)};`;
            }
            if (isHidden) {
                wifiStr += `H:true;`;
            }
            wifiStr += ';';
            return wifiStr;
        }
        case 'vcard': {
            const fn = document.getElementById('vcard-fn').value.trim();
            const ln = document.getElementById('vcard-ln').value.trim();
            const mobile = document.getElementById('vcard-mobile').value.trim();
            const work = document.getElementById('vcard-work').value.trim();
            const email = document.getElementById('vcard-email').value.trim();
            const url = document.getElementById('vcard-url').value.trim();
            const org = document.getElementById('vcard-org').value.trim();
            const title = document.getElementById('vcard-title').value.trim();
            const address = document.getElementById('vcard-address').value.trim();
            
            if (!fn && !ln) return '';
            
            let vcard = 'BEGIN:VCARD\nVERSION:3.0\n';
            vcard += `N:${ln};${fn};;;\n`;
            vcard += `FN:${fn} ${ln}\n`;
            if (org) vcard += `ORG:${org}\n`;
            if (title) vcard += `TITLE:${title}\n`;
            if (mobile) vcard += `TEL;TYPE=CELL:${mobile}\n`;
            if (work) vcard += `TEL;TYPE=WORK:${work}\n`;
            if (email) vcard += `EMAIL;TYPE=PREF,INTERNET:${email}\n`;
            if (address) vcard += `ADR;TYPE=WORK:;;${address};;;;\n`;
            if (url) vcard += `URL:${url}\n`;
            vcard += 'END:VCARD';
            return vcard;
        }
        case 'email': {
            const to = document.getElementById('email-to').value.trim();
            const subject = document.getElementById('email-subject').value.trim();
            const body = document.getElementById('email-body').value;
            
            if (!to) return '';
            
            let mailto = `mailto:${to}`;
            const params = [];
            if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
            if (body) params.push(`body=${encodeURIComponent(body)}`);
            
            if (params.length > 0) {
                mailto += `?${params.join('&')}`;
            }
            return mailto;
        }
        case 'sms': {
            const phone = document.getElementById('sms-phone').value.trim();
            const message = document.getElementById('sms-message').value;
            
            if (!phone) return '';
            
            let sms = `sms:${phone}`;
            if (message) {
                sms += `?body=${encodeURIComponent(message)}`;
            }
            return sms;
        }
        case 'tel': {
            const phone = document.getElementById('tel-number').value.trim();
            if (!phone) return '';
            return `tel:${phone}`;
        }
        case 'whatsapp': {
            let phone = document.getElementById('wa-phone').value.trim();
            const message = document.getElementById('wa-message').value;
            
            if (!phone) return '';
            if (phone.startsWith('0')) {
                phone = phone.substring(1);
            }
            
            let wa = `https://wa.me/66${phone}`;
            if (message) {
                wa += `?text=${encodeURIComponent(message)}`;
            }
            return wa;
        }
        case 'social': {
            const platform = document.getElementById('social-platform').value;
            const input = document.getElementById('social-input').value.trim();
            
            if (!input) return '';
            if (/^https?:\/\//i.test(input)) {
                return input;
            }
            
            switch (platform) {
                case 'facebook': return `https://facebook.com/${input}`;
                case 'instagram': return `https://instagram.com/${input}`;
                case 'x': return `https://x.com/${input}`;
                case 'youtube': return `https://youtube.com/@${input}`;
                case 'tiktok': return `https://tiktok.com/@${input}`;
                case 'linkedin': return `https://linkedin.com/in/${input}`;
                case 'line': return `https://line.me/ti/p/~${input}`;
                default: return input;
            }
        }
        case 'crypto': {
            const coin = document.getElementById('crypto-coin').value;
            const address = document.getElementById('crypto-address').value.trim();
            const amount = document.getElementById('crypto-amount').value.trim();
            
            if (!address) return '';
            
            let cryptoUri = '';
            switch (coin) {
                case 'bitcoin':
                    cryptoUri = `bitcoin:${address}`;
                    if (amount) cryptoUri += `?amount=${amount}`;
                    break;
                case 'ethereum':
                    cryptoUri = `ethereum:${address}`;
                    if (amount) cryptoUri += `?value=${amount}`;
                    break;
                case 'solana':
                    cryptoUri = `solana:${address}`;
                    if (amount) cryptoUri += `?amount=${amount}`;
                    break;
                case 'dogecoin':
                    cryptoUri = `doge:${address}`;
                    if (amount) cryptoUri += `?amount=${amount}`;
                    break;
                case 'binance':
                    cryptoUri = `binance:${address}`;
                    if (amount) cryptoUri += `?amount=${amount}`;
                    break;
                default:
                    cryptoUri = address;
            }
            return cryptoUri;
        }
        case 'event': {
            const title = document.getElementById('event-title').value.trim();
            const start = document.getElementById('event-start').value;
            const end = document.getElementById('event-end').value;
            const location = document.getElementById('event-location').value.trim();
            const desc = document.getElementById('event-desc').value;
            
            if (!title) return '';
            
            let cal = 'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\n';
            cal += `SUMMARY:${title}\n`;
            if (start) cal += `DTSTART:${formatVCalendarDate(start)}\n`;
            if (end) cal += `DTEND:${formatVCalendarDate(end)}\n`;
            if (location) cal += `LOCATION:${location}\n`;
            if (desc) cal += `DESCRIPTION:${desc}\n`;
            cal += 'END:VEVENT\nEND:VCALENDAR';
            return cal;
        }
        case 'location': {
            const lat = document.getElementById('geo-lat').value.trim();
            const lng = document.getElementById('geo-lng').value.trim();
            
            if (!lat || !lng) return '';
            return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        }
        default:
            return '';
    }
}

// Generate the customized SVG code
function generateSVGString(qrDataText, size, margin, ecc, fgColor, bgColor, isGradient, gradStart, gradEnd, gradDir) {
    if (typeof QRCode === 'undefined') {
        showToast("ไม่พบโมดูลสร้าง QR Code");
        return null;
    }
    try {
        const qr = QRCode.create(qrDataText, { errorCorrectionLevel: ecc });
        const numModules = qr.modules.size;
        const viewSize = numModules + margin * 2;
        
        let svg = `<?xml version="1.0" encoding="utf-8"?>\n`;
        svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" width="${size}" height="${size}">\n`;
        svg += `  <rect width="${viewSize}" height="${viewSize}" fill="${bgColor}" />\n`;
        
        if (isGradient) {
            svg += `  <defs>\n`;
            if (gradDir === 'vertical') {
                svg += `    <linearGradient id="qr-grad" x1="0%" y1="0%" x2="0%" y2="100%">\n`;
            } else if (gradDir === 'horizontal') {
                svg += `    <linearGradient id="qr-grad" x1="0%" y1="0%" x2="100%" y2="0%">\n`;
            } else if (gradDir === 'diagonal') {
                svg += `    <linearGradient id="qr-grad" x1="0%" y1="0%" x2="100%" y2="100%">\n`;
            } else {
                svg += `    <linearGradient id="qr-grad" x1="0%" y1="0%" x2="0%" y2="100%">\n`;
            }
            svg += `      <stop offset="0%" stop-color="${gradStart}" />\n`;
            svg += `      <stop offset="100%" stop-color="${gradEnd}" />\n`;
            svg += `    </linearGradient>\n`;
            svg += `  </defs>\n`;
        }
        
        let pathData = '';
        for (let r = 0; r < numModules; r++) {
            for (let c = 0; c < numModules; c++) {
                if (qr.modules.get(c, r)) {
                    const x = c + margin;
                    const y = r + margin;
                    pathData += `M${x},${y}h1v1h-1z `;
                }
            }
        }
        
        const fill = isGradient ? 'url(#qr-grad)' : fgColor;
        svg += `  <path d="${pathData.trim()}" fill="${fill}" />\n`;
        
        // Add embedded Logo image if applicable
        if (logoImg.src && !logoImg.classList.contains('hidden')) {
            const logoPercentage = parseInt(logoSizeRange.value) / 100;
            const logoSvgSize = viewSize * logoPercentage;
            const x = (viewSize - logoSvgSize) / 2;
            const y = (viewSize - logoSvgSize) / 2;
            
            if (logoBorderCheckbox.checked) {
                const padding = logoSvgSize * 0.15;
                const r = logoSvgSize * 0.1;
                svg += `  <rect x="${x - padding}" y="${y - padding}" width="${logoSvgSize + padding * 2}" height="${logoSvgSize + padding * 2}" fill="${bgColor}" rx="${r}" />\n`;
            }
            
            svg += `  <image x="${x}" y="${y}" width="${logoSvgSize}" height="${logoSvgSize}" href="${logoImg.src}" />\n`;
        }
        
        svg += `</svg>`;
        return svg;
    } catch (e) {
        console.error("Error generating SVG:", e);
        return null;
    }
}

// Update UI stats on QR data length and bytes
function updateStats(dataText) {
    const charCounter = document.getElementById('char-counter');
    const dataSize = document.getElementById('data-size');
    const count = dataText.length;
    
    charCounter.textContent = `${count} อักขระ`;
    
    if (count === 0) {
        dataSize.textContent = "รอข้อมูล...";
        return;
    }
    
    const bytes = new Blob([dataText]).size;
    let sizeText = '';
    if (bytes < 1024) {
        sizeText = `${bytes} Bytes`;
    } else {
        sizeText = `${(bytes / 1024).toFixed(2)} KB`;
    }
    dataSize.textContent = `ขนาดข้อมูล: ${sizeText}`;
}

function drawQRCode(qrDataText) {
    const size = parseInt(qrSizeSelect.value) || 512;
    const margin = parseInt(qrMarginSelect.value) || 4;
    const ecc = qrEccSelect.value || 'H';
    
    const isGradient = document.querySelector('input[name="color-mode"]:checked').value === 'gradient';
    const bgColor = qrBgColorInput.value;
    
    if (typeof QRCode === 'undefined') {
        showToast("กำลังดาวน์โหลดโมดูลสร้าง QR Code หรือเกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย กรุณารีเฟรชหน้าเว็บ");
        return;
    }
    
    const qrOptions = {
        errorCorrectionLevel: ecc,
        margin: margin,
        width: size,
        color: {
            dark: '#000000FF', // Solid black modules
            light: '#00000000' // Transparent background (so we can color modules with source-in)
        }
    };
    
    // Draw QR code directly on mainCanvas
    QRCode.toCanvas(mainCanvas, qrDataText, qrOptions, function(err) {
        if (err) {
            console.error(err);
            showToast("ความจุข้อมูลเกินพิกัดสำหรับระดับความปลอดภัยนี้! ลองลดข้อมูลลง หรือปรับระดับความปลอดภัยเป็น L");
            return;
        }
        
        const ctx = mainCanvas.getContext('2d');
        
        // 1. Color the black modules with solid color or gradient
        ctx.globalCompositeOperation = 'source-in';
        
        if (isGradient) {
            const gradStart = qrGradStartInput.value;
            const gradEnd = qrGradEndInput.value;
            const gradDir = qrGradDirSelect.value;
            
            let gradient;
            if (gradDir === 'vertical') {
                gradient = ctx.createLinearGradient(0, 0, 0, size);
            } else if (gradDir === 'horizontal') {
                gradient = ctx.createLinearGradient(0, 0, size, 0);
            } else if (gradDir === 'diagonal') {
                gradient = ctx.createLinearGradient(0, 0, size, size);
            } else if (gradDir === 'radial') {
                gradient = ctx.createRadialGradient(size/2, size/2, 10, size/2, size/2, size/2);
            }
            
            gradient.addColorStop(0, gradStart);
            gradient.addColorStop(1, gradEnd);
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = qrFgColorInput.value;
        }
        
        ctx.fillRect(0, 0, size, size);
        
        // 2. Draw solid background behind the colored modules
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, size, size);
        
        // 3. Reset composite operation to default
        ctx.globalCompositeOperation = 'source-over';
        
        // 4. Draw Center Logo
        if (logoImg.src && !logoImg.classList.contains('hidden')) {
            drawLogoOnCanvas(ctx, size);
        }
    });
}

// Master trigger to update QR Code UI
function generateQRCode() {
    const data = getQRData();
    updateStats(data);
    
    const placeholder = document.getElementById('qr-placeholder');
    
    if (!data) {
        mainCanvas.style.display = 'none';
        placeholder.classList.add('placeholder-active');
        return;
    }
    
    mainCanvas.style.display = 'block';
    placeholder.classList.remove('placeholder-active');
    
    drawQRCode(data);
}

// Initialize datetime inputs
function initDateTimeInputs() {
    const now = new Date();
    const startInput = document.getElementById('event-start');
    const endInput = document.getElementById('event-end');
    
    if (!startInput || !endInput) return;
    
    const tzoffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - tzoffset)).toISOString().slice(0, 16);
    startInput.value = localISOTime;
    
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const localISOTimeEnd = (new Date(oneHourLater - tzoffset)).toISOString().slice(0, 16);
    endInput.value = localISOTimeEnd;
}

// Page load event listener initialization
document.addEventListener('DOMContentLoaded', () => {
    // 1. Set default times safely
    try {
        initDateTimeInputs();
    } catch (e) {
        console.error("Failed to initialize datetime inputs:", e);
    }
    
    // 2. Generate standard Lucide icons safely
    try {
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    } catch (e) {
        console.error("Failed to initialize Lucide icons:", e);
    }
    
    // 3. Trigger initial rendering safely
    try {
        generateQRCode();
    } catch (e) {
        console.error("Failed to render initial QR code:", e);
    }
    
    // 4. Setup Tab click listeners
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`content-${tabId}`).classList.add('active');
            
            generateQRCode();
        });
    });
    
    // 5. Accordion items expanding toggle
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    // Open the first color settings panel by default
    accordionHeaders[0].parentElement.classList.add('active');
    
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const isActive = item.classList.contains('active');
            
            document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('active'));
            
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
    
    // 6. Bind event listeners to input changes
    const allInputs = document.querySelectorAll('input, textarea, select');
    allInputs.forEach(input => {
        if (input.id && (input.id.endsWith('-hex') || input.id === 'logo-upload')) {
            return;
        }
        input.addEventListener('input', generateQRCode);
        input.addEventListener('change', generateQRCode);
    });
    
    // 7. Color picker hex sync
    syncColorPicker('qr-fg-color', 'qr-fg-hex');
    syncColorPicker('qr-bg-color', 'qr-bg-hex');
    syncColorPicker('qr-grad-start', 'qr-grad-start-hex');
    syncColorPicker('qr-grad-end', 'qr-grad-end-hex');
    
    // 8. Color mode radios toggle (Solid vs Gradient)
    const colorModeRadios = document.querySelectorAll('input[name="color-mode"]');
    colorModeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const solidSettings = document.getElementById('solid-color-settings');
            const gradSettings = document.getElementById('gradient-color-settings');
            
            if (this.value === 'gradient') {
                solidSettings.classList.add('hidden');
                gradSettings.classList.remove('hidden');
            } else {
                solidSettings.classList.remove('hidden');
                gradSettings.classList.add('hidden');
            }
            generateQRCode();
        });
    });
    
    // 9. Location tab GPS current location grabber helper
    const btnGetLocation = document.getElementById('btn-get-location');
    if (btnGetLocation) {
        btnGetLocation.addEventListener('click', function() {
            if (navigator.geolocation) {
                btnGetLocation.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> กำลังดึงพิกัด...';
                lucide.createIcons();
                
                navigator.geolocation.getCurrentPosition(
                    function(position) {
                        document.getElementById('geo-lat').value = position.coords.latitude.toFixed(6);
                        document.getElementById('geo-lng').value = position.coords.longitude.toFixed(6);
                        
                        btnGetLocation.innerHTML = '<i data-lucide="locate-fixed"></i> ใช้พิกัดปัจจุบันของฉัน';
                        lucide.createIcons();
                        
                        generateQRCode();
                        showToast("ดึงพิกัดปัจจุบันสำเร็จ!");
                    },
                    function(error) {
                        btnGetLocation.innerHTML = '<i data-lucide="locate-fixed"></i> ใช้พิกัดปัจจุบันของฉัน';
                        lucide.createIcons();
                        showToast("ไม่สามารถเข้าถึงพิกัดได้: " + error.message);
                    }
                );
            } else {
                showToast("เบราว์เซอร์ของคุณไม่รองรับการดึงพิกัด");
            }
        });
    }
    
    // 10. Social Media platform select custom handling
    const socialPlatformSelect = document.getElementById('social-platform');
    const socialLabelText = document.getElementById('social-label-text');
    const socialIcon = document.getElementById('social-icon');
    
    if (socialPlatformSelect) {
        socialPlatformSelect.addEventListener('change', function() {
            const val = this.value;
            if (val === 'line') {
                socialLabelText.textContent = "Line ID หรือ ลิงก์ Add Friend";
                socialIcon.setAttribute('data-lucide', 'user-plus');
            } else {
                socialLabelText.textContent = "ชื่อผู้ใช้ (Username) หรือ ลิงก์โปรไฟล์";
                socialIcon.setAttribute('data-lucide', 'at-sign');
            }
            lucide.createIcons();
            generateQRCode();
        });
    }
    
    // 11. Custom Logo Upload handling
    logoUploadInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 1024 * 500) { // Limit 500KB
            showToast("ขนาดไฟล์ใหญ่เกินไป (แนะนำไม่เกิน 500KB)");
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(event) {
            logoImg.src = event.target.result;
            logoImg.onload = function() {
                logoPreviewImg.src = event.target.result;
                logoPreviewImg.classList.remove('hidden');
                logoPlaceholder.classList.add('hidden');
                btnRemoveLogo.classList.remove('hidden');
                generateQRCode();
            };
        };
        reader.readAsDataURL(file);
    });
    
    btnRemoveLogo.addEventListener('click', function() {
        logoUploadInput.value = '';
        logoImg.removeAttribute('src');
        logoPreviewImg.src = '#';
        logoPreviewImg.classList.add('hidden');
        logoPlaceholder.classList.remove('hidden');
        btnRemoveLogo.classList.add('hidden');
        generateQRCode();
    });
    
    logoSizeRange.addEventListener('input', function() {
        logoSizeVal.textContent = this.value + '%';
        generateQRCode();
    });
    
    logoBorderCheckbox.addEventListener('change', generateQRCode);
    
    // 12. Copy and download button actions
    const btnDownloadPng = document.getElementById('btn-download-png');
    btnDownloadPng.addEventListener('click', function() {
        if (!getQRData()) {
            showToast("กรุณากรอกข้อมูลก่อนดาวน์โหลด");
            return;
        }
        
        const link = document.createElement('a');
        link.download = 'qrcraft-code.png';
        link.href = mainCanvas.toDataURL('image/png');
        link.click();
        showToast("ดาวน์โหลด PNG สำเร็จ!");
    });
    
    const btnCopy = document.getElementById('btn-copy');
    btnCopy.addEventListener('click', function() {
        if (!getQRData()) {
            showToast("กรุณากรอกข้อมูลก่อนคัดลอก");
            return;
        }
        
        mainCanvas.toBlob(function(blob) {
            if (!blob) {
                showToast("เกิดข้อผิดพลาดในการแปลงไฟล์");
                return;
            }
            
            try {
                const item = new ClipboardItem({ 'image/png': blob });
                navigator.clipboard.write([item]).then(function() {
                    showToast("คัดลอกรูปภาพลงคลิปบอร์ดแล้ว!");
                }, function(err) {
                    console.error(err);
                    showToast("ไม่สามารถคัดลอกได้: " + err.message);
                });
            } catch (err) {
                console.error(err);
                showToast("เบราว์เซอร์ของคุณไม่รองรับการคัดลอกรูปภาพโดยตรง");
            }
        }, 'image/png');
    });
    
    const btnDownloadSvg = document.getElementById('btn-download-svg');
    btnDownloadSvg.addEventListener('click', function() {
        const data = getQRData();
        if (!data) {
            showToast("กรุณากรอกข้อมูลก่อนดาวน์โหลด");
            return;
        }
        
        const size = parseInt(qrSizeSelect.value) || 512;
        const margin = parseInt(qrMarginSelect.value) || 4;
        const ecc = qrEccSelect.value || 'H';
        const isGradient = document.querySelector('input[name="color-mode"]:checked').value === 'gradient';
        const bgColor = qrBgColorInput.value;
        const fgColor = qrFgColorInput.value;
        const gradStart = qrGradStartInput.value;
        const gradEnd = qrGradEndInput.value;
        const gradDir = qrGradDirSelect.value;
        
        const svgString = generateSVGString(data, size, margin, ecc, fgColor, bgColor, isGradient, gradStart, gradEnd, gradDir);
        if (!svgString) {
            showToast("ไม่สามารถสร้างไฟล์ SVG ได้");
            return;
        }
        
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const link = document.createElement('a');
        link.download = 'qrcraft-code.svg';
        link.href = URL.createObjectURL(blob);
        link.click();
        showToast("ดาวน์โหลด SVG สำเร็จ!");
    });
});
