class Terminal {
    constructor() {
        this.commandInput = document.getElementById('command-input');
        this.output = document.getElementById('output');
        this.currentDirectory = '~';
        this.commandHistory = [];
        this.historyIndex = -1;
        this.lastTabPress = 0;
        this.tabPressCount = 0;
        this.currentMatches = [];
        this.currentMatchIndex = 0;
        this.isFullscreen = false;
        this.isMinimized = false;
        this.isHidden = false;
        
        this.fileSystem = {
            '~': {
                type: 'directory',
                content: {
                    'Documents': {
                        type: 'directory',
                        content: {}
                    },
                    'Downloads': {
                        type: 'directory',
                        content: {}
                    },
                    'Pictures': {
                        type: 'directory',
                        content: {}
                    },
                    'Music': {
                        type: 'directory',
                        content: {}
                    },
                    'Videos': {
                        type: 'directory',
                        content: {}
                    },
                    'example.txt': {
                        type: 'file',
                        content: 'Bu bir örnek dosyadır.'
                    },
                    'notes.md': {
                        type: 'file',
                        content: '# Notlar\n\nBuraya notlarınızı yazabilirsiniz.'
                    }
                }
            }
        };
        
        this.commands = {
            help: () => this.showHelp(),
            clear: () => this.clear(),
            echo: (args) => this.echo(args),
            pwd: () => this.pwd(),
            ls: () => this.ls(),
            cd: (args) => this.cd(args),
            date: () => this.date(),
            whoami: () => this.whoami(),
            mkdir: (args) => this.mkdir(args),
            touch: (args) => this.touch(args),
            cat: (args) => this.cat(args)
        };

        this.initializeEventListeners();
        this.showWelcomeMessage();
        this.initializeFullscreenButton();
        this.initializeWindowControls();
        this.startIntroTour();
        
        // İmleci başlangıçta doğru konuma getir
        requestAnimationFrame(() => {
            this.commandInput.focus();
            this.updateCursorPosition();
        });
    }

    startIntroTour() {
        const intro = introJs();
        
        intro.setOptions({
            nextLabel: 'İleri',
            prevLabel: 'Geri',
            skipLabel: '×',
            doneLabel: 'Tamam',
            tooltipClass: 'customTooltip',
            showBullets: false,
            showProgress: true,
            disableInteraction: true,
            steps: [
                {
                    title: 'TermLab\'e Hoş Geldiniz!',
                    intro: 'Terminal becerilerinizi geliştirmek için interaktif bir laboratuvar.',
                    position: 'bottom'
                },
                {
                    element: '.terminal-header',
                    title: 'Terminal Başlığı',
                    intro: 'Terminal penceresinin kontrol butonları burada bulunur.',
                    position: 'bottom'
                },
                {
                    element: '.terminal-buttons',
                    title: 'Kontrol Butonları',
                    intro: 'Kırmızı: Kapat\nSarı: Küçült\nYeşil: Tam Ekran',
                    position: 'right'
                },
                {
                    element: '#input-container',
                    title: 'Komut Satırı',
                    intro: 'Linux komutlarınızı buraya yazabilirsiniz.\nBaşlamak için \'help\' yazın.',
                    position: 'top'
                },
                {
                    element: '.prompt',
                    title: 'Prompt',
                    intro: 'Şu an bulunduğunuz dizini gösterir.',
                    position: 'right'
                },
                {
                    element: '.credentials',
                    title: 'Bağlantılar',
                    intro: 'Proje kaynak koduna ve geliştiricinin sosyal medya hesaplarına buradan ulaşabilirsiniz.',
                    position: 'top'
                }
            ]
        });

        // Local storage'da tur gösterildi mi kontrolü
        if (!localStorage.getItem('tourShown')) {
            intro.start();
            localStorage.setItem('tourShown', 'true');
        }
    }

    initializeEventListeners() {
        this.commandInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.executeCommand();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory('up');
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory('down');
            } else if (e.key === 'Tab') {
                e.preventDefault();
                this.handleTabCompletion();
            }
            requestAnimationFrame(() => this.updateCursorPosition());
        });

        this.commandInput.addEventListener('input', () => {
            requestAnimationFrame(() => this.updateCursorPosition());
        });

        this.commandInput.addEventListener('click', () => {
            requestAnimationFrame(() => this.updateCursorPosition());
        });

        this.commandInput.addEventListener('keyup', () => {
            requestAnimationFrame(() => this.updateCursorPosition());
        });

        this.commandInput.addEventListener('mouseup', () => {
            requestAnimationFrame(() => this.updateCursorPosition());
        });

        const terminal = document.querySelector('.terminal-content');
        terminal.addEventListener('click', (e) => {
            if (!window.getSelection().toString()) {
                this.commandInput.focus();
                requestAnimationFrame(() => this.updateCursorPosition());
            }
        });
    }

    updateCursorPosition() {
        const input = this.commandInput;
        const inputLine = input.parentElement;
        const prompt = inputLine.querySelector('.prompt');
        const promptWidth = prompt.getBoundingClientRect().width;
        const cursorPos = input.selectionStart || 0;
        
        inputLine.style.setProperty('--prompt-width', `${promptWidth + 10}px`);
        inputLine.style.setProperty('--cursor-pos', cursorPos);
    }

    handleTabCompletion() {
        const input = this.commandInput.value;
        const lastWord = input.split(' ').pop();
        
        if (!lastWord) return;

        const currentTime = new Date().getTime();
        const timeSinceLastTab = currentTime - this.lastTabPress;
        
        // Eğer son tab'dan 1 saniyeden fazla geçtiyse sayacı sıfırla
        if (timeSinceLastTab > 1000) {
            this.tabPressCount = 0;
            this.currentMatches = [];
            this.currentMatchIndex = 0;
        }
        
        this.lastTabPress = currentTime;
        
        const currentFs = this.getCurrentFileSystem();
        const matches = Object.keys(currentFs).filter(name => 
            name.toLowerCase().startsWith(lastWord.toLowerCase())
        );

        if (matches.length === 0) return;
        
        if (this.tabPressCount === 0) {
            // İlk tab basışı
            if (matches.length === 1) {
                // Tek eşleşme varsa direkt tamamla
                const completion = matches[0];
                const inputParts = this.commandInput.value.split(' ');
                inputParts[inputParts.length - 1] = completion + (currentFs[completion].type === 'directory' ? '/' : '');
                this.commandInput.value = inputParts.join(' ');
            } else {
                // Birden fazla eşleşme varsa kaydet
                this.currentMatches = matches;
                this.appendOutput('\nPossible completions:\n');
                matches.forEach(match => {
                    const type = currentFs[match].type === 'directory' ? '/' : '';
                    this.appendOutput(`${match}${type}  `);
                });
                this.appendOutput('\n');
                
                // Ortak prefix'i bul ve uygula
                const commonPrefix = this.findCommonPrefix(matches);
                if (commonPrefix.length > lastWord.length) {
                    const inputParts = this.commandInput.value.split(' ');
                    inputParts[inputParts.length - 1] = commonPrefix;
                    this.commandInput.value = inputParts.join(' ');
                }
            }
        } else {
            // Sonraki tab basışları
            if (this.currentMatches.length > 0) {
                const inputParts = this.commandInput.value.split(' ');
                const currentMatch = this.currentMatches[this.currentMatchIndex];
                inputParts[inputParts.length - 1] = currentMatch;
                this.commandInput.value = inputParts.join(' ');
                
                // Sonraki eşleşmeye geç
                this.currentMatchIndex = (this.currentMatchIndex + 1) % this.currentMatches.length;
            }
        }

        this.tabPressCount++;
        
        requestAnimationFrame(() => {
            this.scrollToBottom();
            this.commandInput.focus();
        });
    }

    findCommonPrefix(strings) {
        if (strings.length === 0) return '';
        if (strings.length === 1) return strings[0];
        
        let prefix = strings[0];
        for (let i = 1; i < strings.length; i++) {
            while (strings[i].indexOf(prefix) !== 0) {
                prefix = prefix.substring(0, prefix.length - 1);
                if (prefix === '') return '';
            }
        }
        return prefix;
    }

    showWelcomeMessage() {
        const message = `
Welcome to TermLab v1.0.0
Type 'help' to see available commands.

`;
        this.appendOutput(message);
        
        // Welcome message sonrası imleci güncelle
        requestAnimationFrame(() => {
            this.commandInput.focus();
            this.updateCursorPosition();
        });
    }

    executeCommand() {
        const commandText = this.commandInput.value.trim();
        if (commandText) {
            this.commandHistory.push(commandText);
            this.historyIndex = this.commandHistory.length;

            const commandLine = `<span class="prompt">guest@web-terminal:${this.currentDirectory}$</span> ${commandText}\n`;
            this.appendOutput(commandLine);

            const [command, ...args] = commandText.split(' ');
            
            if (this.commands[command]) {
                this.commands[command](args);
            } else {
                this.appendOutput(`bash: ${command}: command not found\n`, 'error-output');
            }
        } else {
            const commandLine = `<span class="prompt">guest@web-terminal:${this.currentDirectory}$</span>\n`;
            this.appendOutput(commandLine);
        }
        
        this.commandInput.value = '';
        
        requestAnimationFrame(() => {
            this.scrollToBottom();
            this.commandInput.focus();
            this.updateCursorPosition();
        });
    }

    scrollToBottom() {
        const terminalContent = document.querySelector('.terminal-content');
        terminalContent.scrollTop = terminalContent.scrollHeight;
    }

    navigateHistory(direction) {
        if (direction === 'up' && this.historyIndex > 0) {
            this.historyIndex--;
            this.commandInput.value = this.commandHistory[this.historyIndex];
        } else if (direction === 'down' && this.historyIndex < this.commandHistory.length - 1) {
            this.historyIndex++;
            this.commandInput.value = this.commandHistory[this.historyIndex];
        } else if (direction === 'down') {
            this.historyIndex = this.commandHistory.length;
            this.commandInput.value = '';
        }
    }

    appendOutput(text, className = '') {
        const output = document.createElement('div');
        output.className = className;
        output.innerHTML = text;
        this.output.appendChild(output);
        this.scrollToBottom();
    }

    showHelp() {
        const helpText = `
Available commands:
  help     - Show this help message
  clear    - Clear the terminal screen
  echo     - Display a message
  pwd      - Print working directory
  ls       - List directory contents
  cd       - Change directory
  date     - Show current date and time
  whoami   - Display current user
  mkdir    - Create a new directory
  touch    - Create a new empty file
  cat      - Display file content

`;
        this.appendOutput(helpText);
    }

    clear() {
        this.output.innerHTML = '';
    }

    echo(args) {
        if (!args || args.length === 0) {
            this.appendOutput('\n');
            return;
        }

        let outputText = '';
        let targetFile = null;
        let appendMode = false;
        
        // > veya >> operatörünün indexini bul
        const redirectIndex = args.findIndex(arg => arg === '>' || arg === '>>');
        
        if (redirectIndex !== -1) {
            // Append mode kontrolü
            appendMode = args[redirectIndex] === '>>';
            
            // Dosya adını al
            if (args.length > redirectIndex + 1) {
                targetFile = args[redirectIndex + 1];
                // Echo metnini al (operatör ve dosya adı hariç)
                outputText = args.slice(0, redirectIndex).join(' ');
            } else {
                this.appendOutput('bash: syntax error near unexpected token `newline\'\n', 'error-output');
                return;
            }

            // Dosya sisteminde dosyayı bul veya oluştur
            const currentFs = this.getCurrentFileSystem();
            
            if (!currentFs[targetFile]) {
                // Dosya yoksa oluştur
                currentFs[targetFile] = {
                    type: 'file',
                    content: ''
                };
            } else if (currentFs[targetFile].type === 'directory') {
                this.appendOutput(`bash: ${targetFile}: Is a directory\n`, 'error-output');
                return;
            }

            // Dosyaya yaz
            if (appendMode) {
                // Append mode: mevcut içeriğe ekle
                currentFs[targetFile].content += outputText + '\n';
            } else {
                // Write mode: üzerine yaz
                currentFs[targetFile].content = outputText + '\n';
            }
        } else {
            // Normal echo işlemi
            outputText = args.join(' ') + '\n';
            this.appendOutput(outputText);
        }
    }

    pwd() {
        this.appendOutput(`/home/guest${this.currentDirectory === '~' ? '' : this.currentDirectory}\n`);
    }

    ls() {
        const currentFs = this.getCurrentFileSystem();
        const output = Object.keys(currentFs).map(name => {
            const type = currentFs[name].type === 'directory' ? '/' : '';
            return name + type;
        }).join('  ');
        this.appendOutput(output + '\n');
    }

    date() {
        this.appendOutput(new Date().toString() + '\n');
    }

    whoami() {
        this.appendOutput('guest\n');
    }

    getCurrentFileSystem() {
        if (this.currentDirectory === '~') {
            return this.fileSystem['~'].content;
        }

        let current = this.fileSystem['~'];
        const parts = this.currentDirectory.split('/').filter(p => p && p !== '~');
        
        for (const part of parts) {
            if (current.content && current.content[part]) {
                current = current.content[part];
            } else {
                return {};
            }
        }
        return current.content || {};
    }

    normalizePath(path) {
        if (!path || path === '~') return '~';
        
        if (path.startsWith('/')) {
            path = '~' + path;
        } else if (!path.startsWith('~')) {
            path = this.currentDirectory === '~' ? 
                   '~/' + path : 
                   this.currentDirectory + '/' + path;
        }

        const parts = path.split('/').filter(p => p);
        const normalized = [];

        for (const part of parts) {
            if (part === '..') {
                normalized.pop();
            } else if (part !== '.' && part !== '~') {
                normalized.push(part);
            }
        }

        return normalized.length === 0 ? '~' : '~/' + normalized.join('/');
    }

    cd(args) {
        if (!args || args.length === 0) {
            this.currentDirectory = '~';
            this.updatePrompt();
            return;
        }

        const path = args[0];
        const normalizedPath = this.normalizePath(path);
        
        // Kök dizin kontrolü
        if (normalizedPath === '~') {
            this.currentDirectory = '~';
            this.updatePrompt();
            return;
        }

        // Dizin yolunu kontrol et
        let current = this.fileSystem['~'];
        const parts = normalizedPath.split('/').filter(p => p && p !== '~');
        
        for (const part of parts) {
            if (current.content && current.content[part]) {
                if (current.content[part].type !== 'directory') {
                    this.appendOutput(`bash: cd: ${path}: Not a directory\n`, 'error-output');
                    return;
                }
                current = current.content[part];
            } else {
                this.appendOutput(`bash: cd: ${path}: No such file or directory\n`, 'error-output');
                return;
            }
        }

        this.currentDirectory = normalizedPath;
        this.updatePrompt();
    }

    updatePrompt() {
        const prompts = document.querySelectorAll('.prompt');
        const lastPrompt = prompts[prompts.length - 1];
        if (lastPrompt) {
            lastPrompt.textContent = `guest@web-terminal:${this.currentDirectory}$`;
        }
    }

    mkdir(args) {
        if (!args || args.length === 0) {
            this.appendOutput('mkdir: missing operand\nTry \'mkdir DIRECTORY\'\n', 'error-output');
            return;
        }

        const dirName = args[0];
        if (dirName.includes('/')) {
            this.appendOutput('mkdir: cannot create directory with path separators\n', 'error-output');
            return;
        }

        const currentFs = this.getCurrentFileSystem();
        
        if (currentFs[dirName]) {
            this.appendOutput(`mkdir: cannot create directory '${dirName}': File exists\n`, 'error-output');
            return;
        }

        currentFs[dirName] = {
            type: 'directory',
            content: {}
        };
    }

    touch(args) {
        if (!args || args.length === 0) {
            this.appendOutput('touch: missing file operand\nTry \'touch FILE\'\n', 'error-output');
            return;
        }

        const fileName = args[0];
        if (fileName.includes('/')) {
            this.appendOutput('touch: cannot create file with path separators\n', 'error-output');
            return;
        }

        const currentFs = this.getCurrentFileSystem();
        
        if (currentFs[fileName]) {
            // Dosya zaten varsa, sadece son değiştirilme zamanını güncelle
            return;
        }

        currentFs[fileName] = {
            type: 'file',
            content: ''
        };
    }

    cat(args) {
        if (!args || args.length === 0) {
            this.appendOutput('cat: missing file operand\nTry \'cat FILE\'\n', 'error-output');
            return;
        }

        const fileName = args[0];
        const currentFs = this.getCurrentFileSystem();

        if (!currentFs[fileName]) {
            this.appendOutput(`cat: ${fileName}: No such file or directory\n`, 'error-output');
            return;
        }

        const file = currentFs[fileName];
        if (file.type === 'directory') {
            this.appendOutput(`cat: ${fileName}: Is a directory\n`, 'error-output');
            return;
        }

        this.appendOutput(file.content + '\n');
    }

    initializeFullscreenButton() {
        const maximizeButton = document.querySelector('.maximize');
        maximizeButton.addEventListener('click', () => this.toggleFullscreen());
    }

    toggleFullscreen() {
        const terminal = document.querySelector('.terminal');
        this.isFullscreen = !this.isFullscreen;
        
        if (this.isFullscreen) {
            terminal.classList.add('fullscreen');
        } else {
            terminal.classList.remove('fullscreen');
        }
        
        // Terminal içeriğini yeniden boyutlandırdıktan sonra en alta kaydır
        setTimeout(() => {
            this.scrollToBottom();
        }, 300);
    }

    initializeWindowControls() {
        const closeButton = document.querySelector('.close');
        const minimizeButton = document.querySelector('.minimize');
        const terminal = document.querySelector('.terminal');
        const container = document.querySelector('.container');

        closeButton.addEventListener('click', () => {
            if (!this.isHidden) {
                terminal.style.display = 'none';
                this.isHidden = true;
                
                // Yeniden açma butonu oluştur
                if (!document.querySelector('.reopen-terminal')) {
                    const reopenButton = document.createElement('button');
                    reopenButton.className = 'reopen-terminal';
                    reopenButton.textContent = 'Open the Terminal';
                    container.insertBefore(reopenButton, container.firstChild);
                    
                    reopenButton.addEventListener('click', () => {
                        terminal.style.display = 'flex';
                        reopenButton.remove();
                        this.isHidden = false;
                        this.commandInput.focus();
                    });
                }
            }
        });

        minimizeButton.addEventListener('click', () => {
            if (!this.isMinimized) {
                terminal.style.transform = 'translateY(calc(50vh - 20px))';
                terminal.style.height = '40px';
                terminal.style.opacity = '0.8';
                this.isMinimized = true;
            } else {
                terminal.style.transform = 'none';
                terminal.style.height = '500px';
                terminal.style.opacity = '1';
                this.isMinimized = false;
                this.commandInput.focus();
            }
        });
    }
}

// Terminal'i başlat
document.addEventListener('DOMContentLoaded', () => {
    window.terminal = new Terminal();
}); 