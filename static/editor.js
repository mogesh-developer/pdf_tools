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
    let annotations = []; // Array of objects { type, page, x, y, w, h, content, color, size }
    let selectedId = null;
    let isDragging = false;
    let startX, startY;
    const pageCache = new Map();

    // DOM Elements
    const pdfCanvas = document.getElementById('pdf-canvas');
    const annotCanvas = document.getElementById('annotation-canvas');
    const pdfCtx = pdfCanvas.getContext('2d');
    const annotCtx = annotCanvas.getContext('2d');
    const sidebar = document.getElementById('thumbnail-sidebar');
    const saveBtn = document.getElementById('save-btn');
    const loader = document.getElementById('editor-loader');
    
    // Tools
    const toolBtns = document.querySelectorAll('.tool-btn');
    const colorPicker = document.getElementById('color-picker');
    const fontSizePicker = document.getElementById('font-size');

    // Init
    async function init() {
        try {
            const url = `/uploads/${window.PDF_FILENAME}`;
            pdfDoc = await pdfjsLib.getDocument(url).promise;
            document.getElementById('page-count').textContent = pdfDoc.numPages;
            
            await renderPage(pageNum);
            generateThumbnails();
            loader.style.display = 'none';
        } catch (error) {
            console.error('Error loading PDF:', error);
            alert('Failed to load PDF.');
        }
    }

    async function renderPage(num) {
        if (rendering) return;
        rendering = true;

        let page;
        if (pageCache.has(num)) {
            page = pageCache.get(num);
        } else {
            page = await pdfDoc.getPage(num);
            pageCache.set(num, page);
        }
        
        const viewport = page.getViewport({ scale });

        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;
        annotCanvas.height = viewport.height;
        annotCanvas.width = viewport.width;

        const renderContext = {
            canvasContext: pdfCtx,
            viewport: viewport
        };
        await page.render(renderContext).promise;
        
        pageNum = num;
        document.getElementById('page-num').textContent = num;
        rendering = false;
        drawAnnotations();
    }

    async function generateThumbnails() {
        sidebar.innerHTML = '';
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.2 });
            const canvas = document.createElement('canvas');
            canvas.className = 'thumb-canvas';
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const div = document.createElement('div');
            div.className = `thumb-item ${i === pageNum ? 'active' : ''}`;
            div.onclick = () => {
                document.querySelectorAll('.thumb-item').forEach(it => it.classList.remove('active'));
                div.classList.add('active');
                renderPage(i);
            };
            
            const span = document.createElement('span');
            span.textContent = i;
            
            div.appendChild(canvas);
            div.appendChild(span);
            sidebar.appendChild(div);

            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
    }

    function drawAnnotations() {
        annotCtx.clearRect(0, 0, annotCanvas.width, annotCanvas.height);
        annotations.filter(a => a.page === pageNum).forEach((ann, idx) => {
            const isSelected = selectedId === idx;
            
            annotCtx.strokeStyle = ann.color || '#6366f1';
            annotCtx.lineWidth = 2;
            
            if (ann.type === 'rect') {
                annotCtx.strokeRect(ann.x, ann.y, ann.w, ann.h);
                if (isSelected) {
                    drawHandles(ann.x, ann.y, ann.w, ann.h);
                }
            } else if (ann.type === 'text') {
                annotCtx.font = `${ann.size || 20}px Plus Jakarta Sans`;
                annotCtx.fillStyle = ann.color || '#000000';
                annotCtx.fillText(ann.content, ann.x, ann.y);
                
                if (isSelected) {
                    const metrics = annotCtx.measureText(ann.content);
                    const h = parseInt(ann.size) || 20;
                    annotCtx.strokeRect(ann.x - 2, ann.y - h, metrics.width + 4, h + 4);
                }
            }
        });
    }

    function drawHandles(x, y, w, h) {
        annotCtx.fillStyle = '#ffffff';
        annotCtx.strokeStyle = '#6366f1';
        const s = 6;
        // Simple corners
        annotCtx.fillRect(x - s/2, y - s/2, s, s);
        annotCtx.strokeRect(x - s/2, y - s/2, s, s);
        
        annotCtx.fillRect(x + w - s/2, y + h - s/2, s, s);
        annotCtx.strokeRect(x + w - s/2, y + h - s/2, s, s);
    }

    // Interaction
    annotCanvas.addEventListener('mousedown', e => {
        const rect = annotCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        if (activeTool === 'select') {
            // Check for hit
            let found = -1;
            annotations.forEach((ann, idx) => {
                if (ann.page !== pageNum) return;
                if (ann.type === 'rect') {
                    if (mx >= ann.x && mx <= ann.x + ann.w && my >= ann.y && my <= ann.y + ann.h) found = idx;
                } else if (ann.type === 'text') {
                    const metrics = annotCtx.measureText(ann.content);
                    const h = parseInt(ann.size) || 20;
                    if (mx >= ann.x && mx <= ann.x + metrics.width && my >= ann.y - h && my <= ann.y) found = idx;
                }
            });
            
            selectedId = found;
            if (selectedId !== -1) {
                isDragging = true;
                const ann = annotations[selectedId];
                startX = mx - ann.x;
                startY = my - ann.y;
                showProperties(ann);
            } else {
                hideProperties();
            }
        } else if (activeTool === 'rect') {
            const newAnn = {
                type: 'rect',
                page: pageNum,
                x: mx,
                y: my,
                w: 10,
                h: 10,
                color: colorPicker.value
            };
            annotations.push(newAnn);
            selectedId = annotations.length - 1;
            activeTool = 'select'; // Switch to select to resize/move
            isDragging = true;
            startX = 0;
            startY = 0;
            updateToolBtns();
            showProperties(newAnn);
        } else if (activeTool === 'text') {
            const content = prompt("Enter text:");
            if (content) {
                annotations.push({
                    type: 'text',
                    page: pageNum,
                    x: mx,
                    y: my,
                    content: content,
                    color: colorPicker.value,
                    size: fontSizePicker.value
                });
            }
            selectedId = annotations.length - 1;
            drawAnnotations();
        }
        drawAnnotations();
    });

    annotCanvas.addEventListener('mousemove', e => {
        if (!isDragging || selectedId === null) return;
        const rect = annotCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        const ann = annotations[selectedId];
        ann.x = mx - startX;
        ann.y = my - startY;
        
        drawAnnotations();
        updateProperties(ann);
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Tool Buttons
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            activeTool = btn.id.replace('tool-', '');
            updateToolBtns();
        });
    });

    function updateToolBtns() {
        toolBtns.forEach(b => {
            b.classList.toggle('active', b.id === `tool-${activeTool}`);
        });
    }

    // Properties
    function showProperties(ann) {
        document.getElementById('no-selection').style.display = 'none';
        document.getElementById('delete-btn').style.display = 'block';
        
        const textProp = document.getElementById('text-properties');
        const rectProp = document.getElementById('rect-properties');
        
        textProp.style.display = ann.type === 'text' ? 'block' : 'none';
        rectProp.style.display = ann.type === 'rect' ? 'block' : 'none';
        
        if (ann.type === 'text') {
            document.getElementById('prop-text-content').value = ann.content;
        } else {
            document.getElementById('prop-w').value = Math.round(ann.w);
            document.getElementById('prop-h').value = Math.round(ann.h);
        }
    }

    function updateProperties(ann) {
        if (ann.type === 'rect') {
            document.getElementById('prop-w').value = Math.round(ann.w);
            document.getElementById('prop-h').value = Math.round(ann.h);
        }
    }

    function hideProperties() {
        document.getElementById('no-selection').style.display = 'block';
        document.getElementById('text-properties').style.display = 'none';
        document.getElementById('rect-properties').style.display = 'none';
        document.getElementById('delete-btn').style.display = 'none';
    }

    document.getElementById('prop-text-content').addEventListener('input', (e) => {
        if (selectedId !== null) {
            annotations[selectedId].content = e.target.value;
            drawAnnotations();
        }
    });

    document.getElementById('prop-w').addEventListener('input', (e) => {
        if (selectedId !== null) {
            annotations[selectedId].w = parseInt(e.target.value);
            drawAnnotations();
        }
    });

    document.getElementById('prop-h').addEventListener('input', (e) => {
        if (selectedId !== null) {
            annotations[selectedId].h = parseInt(e.target.value);
            drawAnnotations();
        }
    });

    document.getElementById('delete-btn').addEventListener('click', () => {
        if (selectedId !== null) {
            annotations.splice(selectedId, 1);
            selectedId = null;
            hideProperties();
            drawAnnotations();
        }
    });

    // Save Logic
    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> Saving...';
        lucide.createIcons();
        
        // Convert canvas coordinates to PDF coordinates
        // PDF units are points (1/72 inch). Canvas units depend on scale.
        // PyMuPDF uses the same point system usually, but we need to check the page size.
        
        const finalAnnotations = [];
        for (const ann of annotations) {
            const page = await pdfDoc.getPage(ann.page);
            const viewport = page.getViewport({ scale: 1.0 });
            
            // scale is what we used to draw
            const factor = 1.0 / scale;
            
            const obj = {
                type: ann.type,
                page: ann.page,
                color: ann.color,
                size: ann.size
            };
            
            if (ann.type === 'text') {
                obj.x = ann.x * factor;
                obj.y = ann.y * factor;
                obj.content = ann.content;
            } else if (ann.type === 'rect') {
                obj.x1 = ann.x * factor;
                obj.y1 = ann.y * factor;
                obj.x2 = (ann.x + ann.w) * factor;
                obj.y2 = (ann.y + ann.h) * factor;
            }
            finalAnnotations.push(obj);
        }

        try {
            const response = await fetch('/save-annotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: window.PDF_FILENAME,
                    annotations: finalAnnotations
                })
            });
            const result = await response.json();
            if (result.status === 'success') {
                if (window.opener && !window.opener.closed) {
                    window.opener.showToast('PDF Saved Successfully!', 'success');
                }
                window.location.href = result.downloadUrl;
            } else {
                alert('Error saving PDF');
            }
        } catch (e) {
            console.error(e);
            alert('Server error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i data-lucide="save"></i> Save Changes';
            lucide.createIcons();
        }
    });

    // Navigation
    document.getElementById('prev-page').onclick = () => {
        if (pageNum <= 1) return;
        renderPage(pageNum - 1);
    };
    document.getElementById('next-page').onclick = () => {
        if (pageNum >= pdfDoc.numPages) return;
        renderPage(pageNum + 1);
    };

    init();
});
