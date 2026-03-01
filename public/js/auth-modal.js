(function () {
  var modal = document.getElementById('auth-modal');
  var signupForm = document.getElementById('signup-form');
  var loginForm = document.getElementById('login-form');
  var signupError = document.getElementById('signup-error');
  var loginError = document.getElementById('login-error');

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

    if (password.length < 8) {
      showError(signupError, 'Password must be at least 8 characters.');
      return;
    }

    var submitBtn = signupForm.querySelector('.auth-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      var res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
