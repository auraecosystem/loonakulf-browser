import { isBlank } from './utils.js';

const form = document.getElementById('invoiceForm');
const nameInput = document.getElementById('clientName');
const clearBtn = document.getElementById('clearBtn');

// 1. Prevent link navigation on the "Clear" link
clearBtn.addEventListener('click', (e) => {
  e.preventDefault();
  nameInput.value = '';
});

// 2. Validate blank input & open an about:blank receipt on submit
form.addEventListener('submit', (e) => {
  e.preventDefault(); // Stops the form from refreshing the page

  if (isBlank(nameInput.value)) {
    alert('Please enter a valid client name.');
    return;
  }

  // 3. Open a clean window to display the generated receipt
  const receiptWindow = window.open('about:blank', '_blank');
  if (receiptWindow) {
    receiptWindow.document.write(`<h1>Receipt for ${nameInput.value}</h1>`);
    receiptWindow.document.close();
  }
});
