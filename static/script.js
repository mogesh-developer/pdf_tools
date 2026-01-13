document.addEventListener('DOMContentLoaded', () => {
    
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
            
            cards.forEach(card => {
                // Search in Title, Description, and hidden Data Tags
                const title = card.querySelector('h3').textContent.toLowerCase();
                const desc = card.querySelector('p').textContent.toLowerCase();
                const tags = card.dataset.tags ? card.dataset.tags.toLowerCase() : '';
                
                if (title.includes(term) || desc.includes(term) || tags.includes(term)) {
                    card.style.display = 'block';
                    // Optional: Add a fade-in animation
                    card.style.animation = 'fadeIn 0.3s ease forwards';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

    /* --------------------------------------------------
       2. Enhanced File Input Interaction
    -------------------------------------------------- */
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
        const dropZone = input.closest('.drop-zone');
        const label = dropZone.querySelector('.drop-content span');
        const icon = dropZone.querySelector('.drop-content i');

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
                    // Smart Truncate: "very_long_file_name.pdf" -> "very_long...pdf"
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
       3. Loader & System State
    -------------------------------------------------- */
    const forms = document.querySelectorAll('form');
    const loader = document.getElementById('loader');

    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            if (form.checkValidity()) {
                loader.style.display = 'flex';
                // Ensure text updates based on tool
                const btnText = form.querySelector('button').innerText;
                const loaderText = loader.querySelector('p');
                loaderText.textContent = `Processing: ${btnText}...`;
            }
        });
    });

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
    `;
    document.head.appendChild(styleSheet);
});