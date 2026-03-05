(function () {
  var modal = document.getElementById('auth-modal');
  var signupForm = document.getElementById('signup-form');
  var loginForm = document.getElementById('login-form');
  var signupError = document.getElementById('signup-error');
  var loginError = document.getElementById('login-error');
  var csrfToken = '';

  // Fetch CSRF token
  async function fetchCsrfToken() {
    try {
      var res = await fetch('/api/auth/csrf-token');
      var data = await res.json();
      csrfToken = data.csrfToken;
    } catch (e) {
      console.error('Failed to fetch CSRF token:', e);
    }
  }

  // Fetch token on page load
  fetchCsrfToken();

  // Password strength indicator
  function createPasswordStrength() {
    var passwordInput = signupForm.querySelector('[name="password"]');
    if (!passwordInput) return;

    var container = document.createElement('div');
    container.className = 'password-strength';
    container.innerHTML = [
      '<div class="strength-rule" data-rule="length">At least 8 characters</div>',
      '<div class="strength-rule" data-rule="upper">An uppercase letter</div>',
      '<div class="strength-rule" data-rule="lower">A lowercase letter</div>',
      '<div class="strength-rule" data-rule="number">A number</div>',
      '<div class="strength-rule" data-rule="special">A special character</div>',
    ].join('');

    var field = passwordInput.closest('.auth-field');
    field.appendChild(container);

    passwordInput.addEventListener('input', function () {
      var val = passwordInput.value;
      setRule(container, 'length', val.length >= 8);
      setRule(container, 'upper', /[A-Z]/.test(val));
      setRule(container, 'lower', /[a-z]/.test(val));
      setRule(container, 'number', /[0-9]/.test(val));
      setRule(container, 'special', /[^A-Za-z0-9]/.test(val));
      container.style.display = val.length > 0 ? 'block' : 'none';
    });
  }

  function setRule(container, rule, passing) {
    var el = container.querySelector('[data-rule="' + rule + '"]');
    if (el) {
      el.classList.toggle('pass', passing);
      el.classList.toggle('fail', !passing);
    }
  }

  createPasswordStrength();

  // Open modal in signup or login mode
  function openModal(mode) {
    if (mode === 'login') {
      signupForm.hidden = true;
      loginForm.hidden = false;
    } else {
      signupForm.hidden = false;
      loginForm.hidden = true;
    }
    clearErrors();
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Refresh CSRF token when modal opens
    fetchCsrfToken();
  }

  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function clearErrors() {
    signupError.hidden = true;
    signupError.textContent = '';
    loginError.hidden = true;
    loginError.textContent = '';
  }

  function showError(el, message) {
    el.textContent = message;
    el.hidden = false;
  }

  // Wire up buttons that open sign-up modal
  var signupTriggers = ['hero-signup', 'cta-signup', 'nav-get-started'];
  signupTriggers.forEach(function (id) {
    var btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openModal('signup');
      });
    }
  });

  // Wire up login nav link
  var loginBtn = document.getElementById('nav-login');
  if (loginBtn) {
    loginBtn.addEventListener('click', function (e) {
      e.preventDefault();
      openModal('login');
    });
  }

  // Toggle between forms
  var showLogin = document.getElementById('show-login');
  var showSignup = document.getElementById('show-signup');

  if (showLogin) {
    showLogin.addEventListener('click', function (e) {
      e.preventDefault();
      openModal('login');
    });
  }

  if (showSignup) {
    showSignup.addEventListener('click', function (e) {
      e.preventDefault();
      openModal('signup');
    });
  }

  // Close modal on backdrop click or Escape
  modal.querySelector('.auth-backdrop').addEventListener('click', closeModal);
  modal.querySelector('.auth-close').addEventListener('click', closeModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  // Sign-up form submission
  signupForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearErrors();

    var firstName = signupForm.querySelector('[name="firstName"]').value.trim();
    var lastName = signupForm.querySelector('[name="lastName"]').value.trim();
    var email = signupForm.querySelector('[name="email"]').value.trim();
    var password = signupForm.querySelector('[name="password"]').value;

    if (!firstName || !lastName || !email || !password) {
      showError(signupError, 'All fields are required.');
      return;
    }

    // Client-side password complexity check
    var issues = [];
    if (password.length < 8) issues.push('at least 8 characters');
    if (!/[A-Z]/.test(password)) issues.push('an uppercase letter');
    if (!/[a-z]/.test(password)) issues.push('a lowercase letter');
    if (!/[0-9]/.test(password)) issues.push('a number');
    if (!/[^A-Za-z0-9]/.test(password)) issues.push('a special character');
    if (issues.length > 0) {
      showError(signupError, 'Password must contain ' + issues.join(', ') + '.');
      return;
    }

    var submitBtn = signupForm.querySelector('.auth-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      var res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({ firstName: firstName, lastName: lastName, email: email, password: password })
      });

      var data = await res.json();

      if (!res.ok) {
        showError(signupError, data.error || 'Something went wrong.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create account';
        return;
      }

      window.location.href = '/product.html';
    } catch (err) {
      showError(signupError, 'Network error. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create account';
    }
  });

  // Login form submission
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearErrors();

    var email = loginForm.querySelector('[name="email"]').value.trim();
    var password = loginForm.querySelector('[name="password"]').value;

    if (!email || !password) {
      showError(loginError, 'Email and password are required.');
      return;
    }

    var submitBtn = loginForm.querySelector('.auth-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    try {
      var res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({ email: email, password: password })
      });

      var data = await res.json();

      if (!res.ok) {
        showError(loginError, data.error || 'Something went wrong.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log in';
        return;
      }

      window.location.href = '/product.html';
    } catch (err) {
      showError(loginError, 'Network error. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log in';
    }
  });
})();
