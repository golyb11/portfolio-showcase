(function () {
  'use strict';

  function init() {
    var form = document.getElementById('loginForm');
    var emailInput = document.getElementById('email');
    var passwordInput = document.getElementById('password');
    var loginBtn = document.getElementById('loginBtn');
    var emailError = document.getElementById('emailError');
    var passwordError = document.getElementById('passwordError');

    if (!form || !loginBtn || !emailInput || !passwordInput) {
      console.error('[Login] Required DOM elements missing');
      return;
    }

    if (!emailInput.value) emailInput.value = 'alice@portfolio.dev';
    if (!passwordInput.value) passwordInput.value = 'Demo@Password123!';

    function getCsrfToken() {
      var meta = document.querySelector('meta[name="csrf-token"]');
      if (meta && meta.getAttribute('content')) {
        return meta.getAttribute('content');
      }
      var hidden = form.querySelector('input[name="csrfmiddlewaretoken"]');
      if (hidden && hidden.value) return hidden.value;
      var cookies = document.cookie.split('; ');
      for (var i = 0; i < cookies.length; i += 1) {
        if (cookies[i].indexOf('csrftoken=') === 0) {
          return decodeURIComponent(cookies[i].split('=')[1]);
        }
      }
      return '';
    }

    function clearErrors() {
      emailError.textContent = '';
      passwordError.textContent = '';
      emailInput.classList.remove('input--error');
      passwordInput.classList.remove('input--error');
    }

    function showError(field, message) {
      if (field === 'email') {
        emailError.textContent = message;
        emailInput.classList.add('input--error');
      } else if (field === 'password') {
        passwordError.textContent = message;
        passwordInput.classList.add('input--error');
      }
    }

    async function handleSubmit(e) {
      if (e) e.preventDefault();
      clearErrors();

      var email = emailInput.value.trim();
      var password = passwordInput.value;

      if (!email) {
        showError('email', 'Email is required');
        emailInput.focus();
        return;
      }
      if (!password) {
        showError('password', 'Password is required');
        passwordInput.focus();
        return;
      }

      loginBtn.disabled = true;
      var originalLabel = loginBtn.textContent;
      loginBtn.textContent = 'Signing in...';

      try {
        var response = await fetch('/api/auth/login/', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ email: email, password: password }),
        });

        var data = null;
        try {
          data = await response.json();
        } catch (err) {
          data = null;
        }

        if (response.ok && data && data.status === 'success') {
          window.location.href = '/dashboard/';
          return;
        }

        var msg =
          (data && data.message) || 'Login failed (HTTP ' + response.status + ')';
        showError('email', msg);
        console.error('[Login] Failed:', response.status, data);
      } catch (error) {
        showError('email', 'Network error. Please try again.');
        console.error('[Login] Network error:', error);
      } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = originalLabel;
      }
    }

    form.addEventListener('submit', handleSubmit);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
