document.addEventListener('DOMContentLoaded', () => {
    
    /* --------------------------------------------------
       0. UI Helpers (Toasts & Progress)
    -------------------------------------------------- */
    const toastContainer = document.getElementById('toast-container');
    const progressBar = document.createElement('div');
    progressBar.className = 'upload-progress';
    document.body.appendChild(progressBar);

    window.showToast = (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'info';
        if(type === 'success') icon = 'check-circle';
        if(type === 'error') icon = 'alert-circle';
        
        toast.innerHTML = `
            <i data-lucide="${icon}"></i>
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        lucide.createIcons();
        
        setTimeout(() => {
            toast.classList.add('toast-closing');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    };

    /* --------------------------------------------------
       1. Search Filter Logic (Live Filtering)
    -------------------------------------------------- */
    const searchInput = document.getElementById('toolSearch');
    const cards = document.querySelectorAll('.tool-card');
    const toolsGrid = document.getElementById('toolsGrid');

    if(searchInput) {
        // Keyboard Shortcut (Cmd/Ctrl + K)
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
            }
        });

        // Filter Function
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            let visibleCount = 0;
            
            cards.forEach(card => {
                // Search in Title, Description, and hidden Data Tags
                const title = card.querySelector('h3').textContent.toLowerCase();
                const desc = card.querySelector('p').textContent.toLowerCase();
                const tags = card.dataset.tags ? card.dataset.tags.toLowerCase() : '';
                
                if (title.includes(term) || desc.includes(term) || tags.includes(term)) {
                    card.style.display = 'block';
                    card.style.animation = 'fadeIn 0.3s ease forwards';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });

            if(visibleCount === 0 && term !== '') {
                // Show empty state if needed
            }
        });
    }

    /* --------------------------------------------------
       2. Enhanced File Input Interaction
    -------------------------------------------------- */
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
        const dropZone = input.closest('.drop-zone, .drop-zone-mini');
        if(!dropZone) return;
        
        const label = dropZone.querySelector('span'); // More generic
        const icon = dropZone.querySelector('i');

        // Drag & Drop Visuals
        ['dragenter', 'dragover'].forEach(eName => {
            dropZone.addEventListener(eName, (e) => {
                e.preventDefault();
                dropZone.classList.add('active');
            });
        });

        ['dragleave', 'drop'].forEach(eName => {
            dropZone.addEventListener(eName, (e) => {
                e.preventDefault();
                dropZone.classList.remove('active');
            });
        });

        // File Selection Logic
        input.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                dropZone.classList.add('has-file');
                showToast(`${files.length} file(s) ready for processing`, 'info');
                
                // Icon Change
                if (icon) {
                    icon.setAttribute('data-lucide', 'check-circle');
                    lucide.createIcons();
                }

                // Text Update
                if (files.length > 1) {
                    label.textContent = `${files.length} files selected`;
                } else {
                    let fname = files[0].name;
                    if (fname.length > 25) {
                        const ext = fname.split('.').pop();
                        const base = fname.substring(0, 20);
                        fname = `${base}...${ext}`;
                    }
                    label.textContent = fname;
                }
            }
        });
    });

    /* --------------------------------------------------
       3. Loader & Form Handling (Speed Up Feedback)
    -------------------------------------------------- */
    const forms = document.querySelectorAll('form');
    const loader = document.getElementById('loader');

    forms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            if (form.getAttribute('action') === '/html-to-pdf') return; // Regular submit for now
            if (form.getAttribute('action') === '/upload-for-edit') return;

            e.preventDefault();
            
            if (!form.checkValidity()) return;

            const formData = new FormData(form);
            const action = form.getAttribute('action');
            const submitBtn = form.querySelector('button');
            const originalBtnText = submitBtn.innerText;

            try {
                loader.style.display = 'flex';
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> Processing...';
                lucide.createIcons();
                
                progressBar.style.width = '30%';

                const response = await fetch(action, {
                    method: 'POST',
                    body: formData
                });

                progressBar.style.width = '70%';

                if (!response.ok) throw new Error('Processing failed');

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                
                // Get filename from header or fallback
                const disposition = response.headers.get('content-disposition');
                let filename = "processed_document.pdf";
                if (disposition && disposition.indexOf('attachment') !== -1) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) { 
                      filename = matches[1].replace(/['"]/g, '');
                    }
                }
                
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                
                progressBar.style.width = '100%';
                showToast('Success! Your document is ready.', 'success');
                
                // Track recent files
                saveRecentFile(filename);

            } catch (error) {
                console.error(error);
                showToast('An error occurred during processing.', 'error');
            } finally {
                setTimeout(() => {
                    loader.style.display = 'none';
                    submitBtn.disabled = false;
                    submitBtn.innerText = originalBtnText;
                    progressBar.style.width = '0%';
                }, 500);
            }
        });
    });

    function saveRecentFile(name) {
        let recent = JSON.parse(localStorage.getItem('recent_files') || '[]');
        recent = recent.filter(f => f.name !== name);
        recent.unshift({ name, date: new Date().toLocaleTimeString() });
        localStorage.setItem('recent_files', JSON.stringify(recent.slice(0, 5)));
        renderRecentFiles();
    }

    function renderRecentFiles() {
        const bar = document.getElementById('recentBar');
        const list = document.getElementById('recentList');
        if(!bar || !list) return;

        const recent = JSON.parse(localStorage.getItem('recent_files') || '[]');
        if (recent.length === 0) {
            bar.style.display = 'none';
            return;
        }

        bar.style.display = 'flex';
        list.innerHTML = recent.map(f => `<span class="recent-item" title="Processed at ${f.date}">${f.name}</span>`).join('');
    }

    window.clearRecent = () => {
        localStorage.removeItem('recent_files');
        renderRecentFiles();
        showToast('Recent history cleared', 'info');
    };

    renderRecentFiles();

    // Restore state on back button
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) loader.style.display = 'none';
    });

    // Add fadeIn animation to CSS dynamically for search
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(styleSheet);
});