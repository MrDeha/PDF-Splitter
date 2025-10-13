/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// pdf-lib kütüphanesini global kapsamdan kullanmak için tip tanımı yapıyoruz.
declare const PDFLib: any;

const fileUpload = document.getElementById('file-upload') as HTMLInputElement;
const pageRangesInput = document.getElementById('page-ranges') as HTMLInputElement;
const splitButton = document.getElementById('split-button') as HTMLButtonElement;
const statusElement = document.getElementById('status') as HTMLParagraphElement;
const fileNameDisplay = document.getElementById('file-name') as HTMLParagraphElement;
const buttonText = splitButton.querySelector('.button-text') as HTMLSpanElement;
const spinner = splitButton.querySelector('.spinner') as HTMLSpanElement;

let selectedFile: File | null = null;

function updateButtonState() {
    splitButton.disabled = !(selectedFile && pageRangesInput.value.trim() !== '');
}

fileUpload.addEventListener('change', () => {
    if (fileUpload.files && fileUpload.files.length > 0) {
        const file = fileUpload.files[0];
        if (file.type !== 'application/pdf') {
            showStatus('Lütfen bir PDF dosyası seçin.', true);
            fileUpload.value = '';
            selectedFile = null;
            fileNameDisplay.textContent = '';
        } else {
            selectedFile = file;
            fileNameDisplay.textContent = selectedFile.name;
            showStatus('');
        }
    } else {
        selectedFile = null;
        fileNameDisplay.textContent = '';
    }
    updateButtonState();
});

pageRangesInput.addEventListener('input', updateButtonState);

splitButton.addEventListener('click', async () => {
    if (!selectedFile || !pageRangesInput.value.trim()) {
        showStatus('Lütfen bir dosya seçin ve sayfa aralıklarını girin.', true);
        return;
    }

    setLoading(true);
    showStatus('PDF işleniyor, lütfen bekleyin...', false);

    try {
        const pagesToExtract = parsePageRanges(pageRangesInput.value);
        if (pagesToExtract.length === 0) {
            throw new Error('Geçersiz sayfa aralığı formatı. Örn: 1-3, 5, 8');
        }

        const arrayBuffer = await selectedFile.arrayBuffer();
        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const totalPages = pdfDoc.getPageCount();

        const invalidPages = pagesToExtract.filter(p => p < 1 || p > totalPages);
        if (invalidPages.length > 0) {
            throw new Error(`Geçersiz sayfa numarası: ${invalidPages.join(', ')}. Belge ${totalPages} sayfadan oluşuyor.`);
        }

        const newPdfDoc = await PDFDocument.create();
        const pageIndices = pagesToExtract.map(p => p - 1); // 0-tabanlı indekse çevir
        const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
        copiedPages.forEach(page => newPdfDoc.addPage(page));

        const pdfBytes = await newPdfDoc.save();
        const originalFileName = selectedFile.name.replace(/\.pdf$/i, '');
        downloadPdf(pdfBytes, `${originalFileName}-ayrildi.pdf`);

        showStatus('PDF başarıyla ayrıldı ve indirildi!', false);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu.';
        showStatus(`Hata: ${message}`, true);
    } finally {
        setLoading(false);
    }
});

function parsePageRanges(rangeStr: string): number[] {
    const pages = new Set<number>();
    const ranges = rangeStr.split(',');

    for (const range of ranges) {
        const trimmedRange = range.trim();
        if (trimmedRange.includes('-')) {
            const [start, end] = trimmedRange.split('-').map(num => parseInt(num.trim(), 10));
            if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let i = start; i <= end; i++) {
                    pages.add(i);
                }
            }
        } else {
            const pageNum = parseInt(trimmedRange, 10);
            if (!isNaN(pageNum)) {
                pages.add(pageNum);
            }
        }
    }
    return Array.from(pages).sort((a, b) => a - b);
}

function downloadPdf(bytes: Uint8Array, filename: string) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

function showStatus(message: string, isError: boolean = false) {
    statusElement.textContent = message;
    statusElement.className = isError ? 'error' : 'success';
}

function setLoading(isLoading: boolean) {
    splitButton.disabled = isLoading;
    spinner.style.display = isLoading ? 'inline-block' : 'none';
    buttonText.style.display = isLoading ? 'none' : 'inline-block';
}
