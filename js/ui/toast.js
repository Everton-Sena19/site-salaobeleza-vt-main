let toastTimeout = null;

export function showToast(message, type = 'success') {
  let toast = document.getElementById('app-toast');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'app-toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.setAttribute('data-type', type);
  toast.classList.add('visible');

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove('visible');
  }, 3000);
}