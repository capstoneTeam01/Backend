const header = document.querySelector(".site-header");
const menuButton = document.querySelector(".menu-button");
const navigation = document.querySelector(".primary-nav");
const contactForm = document.querySelector(".contact-form");
const formStatus = document.querySelector(".form-status");

const closeMenu = () => {
  menuButton?.setAttribute("aria-expanded", "false");
  navigation?.classList.remove("open");
  document.body.classList.remove("menu-open");
};

menuButton?.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isOpen));
  navigation.classList.toggle("open", !isOpen);
  document.body.classList.toggle("menu-open", !isOpen);
});

navigation?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeMenu);
});

window.addEventListener("scroll", () => {
  header?.classList.toggle("scrolled", window.scrollY > 24);
}, { passive: true });

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("visible");
    observer.unobserve(entry.target);
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach((element) => {
  revealObserver.observe(element);
});

contactForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const fields = [...contactForm.querySelectorAll("input, textarea")];
  let valid = true;

  fields.forEach((field) => {
    const fieldValid = field.checkValidity();
    field.classList.toggle("invalid", !fieldValid);
    valid = valid && fieldValid;
  });

  if (!valid) {
    formStatus.textContent = "Please complete every field with a valid email address.";
    return;
  }

  const data = new FormData(contactForm);
  const subject = encodeURIComponent(`[FixBee] ${data.get("subject")}`);
  const body = encodeURIComponent(
    `Name: ${data.get("name")}\nEmail: ${data.get("email")}\n\n${data.get("message")}`
  );

  formStatus.textContent = "Opening your email app...";
  window.location.href = `mailto:fixbee.team@gmail.com?subject=${subject}&body=${body}`;
});

document.querySelectorAll("[data-current-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});
