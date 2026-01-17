document.addEventListener('DOMContentLoaded', () => {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const grid = document.getElementById('organize-grid');
    const loader = document.getElementById('editor-loader');
    const saveBtn = document.getElementById('save-organize');
    let pdfDoc = null;

    async function init() {
        const url = `/uploads/${window.PDF_FILENAME}`;
        pdfDoc = await pdfjsLib.getDocument(url).promise;
        
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.3 });
            
            const card = document.createElement('div');
            card.className = 'page-card';
            card.dataset.pageNum = i;
            
            const canvas = document.createElement('canvas');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            
            const label = document.createElement('div');
            label.className = 'page-label';
            label.textContent = i;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'page-delete';
            deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                card.remove();
            };

            card.appendChild(canvas);
            card.appendChild(label);
            card.appendChild(deleteBtn);
            grid.appendChild(card);
        }
        
        lucide.createIcons();
        loader.style.display = 'none';

        // Initialize drag & drop
        new Sortable(grid, {
            animation: 150,
            ghostClass: 'sortable-ghost'
        });
    }

    saveBtn.onclick = async () => {
        const order = Array.from(grid.children).map(card => parseInt(card.dataset.pageNum));
        saveBtn.disabled = true;
        
        const resp = await fetch('/do-organize', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ filename: window.PDF_FILENAME, order })
        });
        
        const res = await resp.json();
        if (res.status === 'success') window.location.href = res.downloadUrl;
    };

    init();
});
