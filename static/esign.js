document.addEventListener('DOMContentLoaded', () => {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    // UI Helpers
    const toastContainer = document.getElementById('toast-container');
    window.showToast = (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        let icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : 'info');
        toast.innerHTML = `<i data-lucide="${icon}"></i><span>${message}</span>`;
        toastContainer.appendChild(toast);
        lucide.createIcons();
        setTimeout(() => {
            toast.classList.add('toast-closing');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // State
    let pdfDoc = null;
    let pageNum = 1;
    let scale = 1.5;
    let rendering = false;
    let activeTool = 'select';
    let annotations = []; // { type: 'signature', page, x, y, w, h, dataUrl }
    let selectedId = null;
    let isDragging = false;
    let startX, startY;
    const pageCache = new Map();

    // Signature Pad logic
    const sigPad = document.getElementById('signature-pad');
    const sigCtx = sigPad.getContext('2d');
    let signing = false;

    sigPad.addEventListener('mousedown', () => signing = true);
    sigPad.addEventListener('mouseup', () => signing = false);
    sigPad.addEventListener('mousemove', (e) => {
        if (!signing) return;
        const rect = sigPad.getBoundingClientRect();
        sigCtx.lineWidth = 2;
        sigCtx.lineCap = 'round';
        sigCtx.strokeStyle = '#000';
        sigCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        sigCtx.stroke();
        sigCtx.beginPath();
        sigCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    });

    window.clearPad = () => {
        sigCtx.clearRect(0, 0, sigPad.width, sigPad.height);
        sigCtx.beginPath();
    };

    window.addSignatureToPage = () => {
        const dataUrl = sigPad.toDataURL();
        annotations.push({
            type: 'image',
            page: pageNum,
            x: 50,
            y: 50,
            w: 150,
            h: 75,
            image_base64: dataUrl
        });
        selectedId = annotations.length - 1;
        drawAnnotations();
        showToast('Signature added! Drag to position.', 'success');
    };

    // PDF logic (reused from editor.js)
    const pdfCanvas = document.getElementById('pdf-canvas');
    const annotCanvas = document.getElementById('annotation-canvas');
    const pdfCtx = pdfCanvas.getContext('2d');
    const annotCtx = annotCanvas.getContext('2d');
    const sidebar = document.getElementById('thumbnail-sidebar');
    const saveBtn = document.getElementById('save-btn');
    const loader = document.getElementById('editor-loader');

    async function init() {
        try {
            const url = `/uploads/${window.PDF_FILENAME}`;
            pdfDoc = await pdfjsLib.getDocument(url).promise;
            document.getElementById('page-count').textContent = pdfDoc.numPages;
            await renderPage(pageNum);
            generateThumbnails();
            loader.style.display = 'none';
        } catch (error) {
            showToast('Failed to load PDF.', 'error');
        }
    }

    async function renderPage(num) {
        if (rendering) return;
        rendering = true;
        let page = pageCache.has(num) ? pageCache.get(num) : await pdfDoc.getPage(num);
        pageCache.set(num, page);
        const viewport = page.getViewport({ scale });
        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;
        annotCanvas.height = viewport.height;
        annotCanvas.width = viewport.width;
        await page.render({ canvasContext: pdfCtx, viewport }).promise;
        pageNum = num;
        document.getElementById('page-num').textContent = num;
        rendering = false;
        drawAnnotations();
    }

    function drawAnnotations() {
        annotCtx.clearRect(0, 0, annotCanvas.width, annotCanvas.height);
        annotations.filter(a => a.page === pageNum).forEach((ann, idx) => {
            const isSelected = selectedId === idx;
            if (ann.type === 'image') {
                const img = new Image();
                img.src = ann.image_base64;
                annotCtx.drawImage(img, ann.x, ann.y, ann.w, ann.h);
                if (isSelected) {
                    annotCtx.strokeStyle = '#6366f1';
                    annotCtx.strokeRect(ann.x, ann.y, ann.w, ann.h);
                }
            }
        });
    }

    annotCanvas.addEventListener('mousedown', e => {
        const rect = annotCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        let found = -1;
        annotations.forEach((ann, idx) => {
            if (ann.page !== pageNum) return;
            if (mx >= ann.x && mx <= ann.x + ann.w && my >= ann.y && my <= ann.y + ann.h) found = idx;
        });
        
        selectedId = found;
        if (selectedId !== -1) {
            isDragging = true;
            startX = mx - annotations[selectedId].x;
            startY = my - annotations[selectedId].y;
        }
        drawAnnotations();
    });

    annotCanvas.addEventListener('mousemove', e => {
        if (!isDragging || selectedId === null) return;
        const rect = annotCanvas.getBoundingClientRect();
        const ann = annotations[selectedId];
        ann.x = (e.clientX - rect.left) - startX;
        ann.y = (e.clientY - rect.top) - startY;
        drawAnnotations();
    });

    window.addEventListener('mouseup', () => isDragging = false);

    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        const finalAnnotations = annotations.map(ann => {
            const factor = 1.0 / scale;
            return {
                type: 'image_base64',  // Special type handled in backend if needed
                page: ann.page,
                x1: ann.x * factor,
                y1: ann.y * factor,
                x2: (ann.x + ann.w) * factor,
                y2: (ann.y + ann.h) * factor,
                image_base64: ann.image_base64
            };
        });

        const resp = await fetch('/save-annotations', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ filename: window.PDF_FILENAME, annotations: finalAnnotations })
        });
        const res = await resp.json();
        if (res.status === 'success') window.location.href = res.downloadUrl;
    });

    // Reuse other editor functions...
    async function generateThumbnails() { /* ... */ } 
    document.getElementById('prev-page').onclick = () => pageNum > 1 && renderPage(pageNum - 1);
    document.getElementById('next-page').onclick = () => pageNum < pdfDoc.numPages && renderPage(pageNum + 1);

    init();
});
