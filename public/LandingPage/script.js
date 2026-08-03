const TEAM = [
  {
    name: "Anmol Singh",
    role: "Full-Stack Developer (PM)",
    photo: "assets/new/Anmol.svg",
    socials: [
      {
        icon: "linkedin",
        label: "Anmol Singh on LinkedIn",
        href: "https://linkedin.com/in/anmol-singh-tech",
      },
      {
        icon: "github",
        label: "Anmol Singh on GitHub",
        href: "https://github.com/anmolss-tech",
      },
    ],
  },

  {
    name: "Ankit Kate",
    role: "UI/UX Designer (Co-Lead)",
    photo: "assets/new/Ankit.svg",
    socials: [
      {
        icon: "linkedin",
        label: "Ankit Kate on LinkedIn",
        href: "https://linkedin.com/in/ankitkate",
      },
      {
        icon: "globe",
        label: "Ankit Kate portfolio",
        href: "https://www.ankitkate.com",
      },
    ],
  },
  {
    name: "Theertha Vinod",
    role: "UI/UX Designer (Co-Lead)",
    photo: "assets/new/Theertha.svg",
    socials: [
      {
        icon: "linkedin",
        label: "Theertha Vinod on LinkedIn",
        href: "https://linkedin.com/in/theerthaavinod",
      },
      {
        icon: "globe",
        label: "Theertha Vinod portfolio",
        href: "https://www.theerthavinod.com",
      },
    ],
  },
  {
    name: "Mekhala Mannapatt",
    role: "UI/UX Designer",
    photo: "assets/new/Mekhala.svg",
    socials: [
      {
        icon: "linkedin",
        label: "Mekhala Mannapatt on LinkedIn",
        href: "https://linkedin.com/in/mekhalamanappatt",
      },
      {
        icon: "behance",
        label: "Mekhala Mannapatt on Behance",
        href: "https://behance.net/mekhalamuraly",
      },
    ],
  },
  {
    name: "Kumara Swamy",
    role: "Full-Stack Developer (Lead)",
    photo: "assets/new/Kumara.svg",
    socials: [
      {
        icon: "linkedin",
        label: "Kumara Swamy on LinkedIn",
        href: "https://linkedin.com/in/kumaraswamy-barapati",
      },
      {
        icon: "github",
        label: "Kumara Swamy on GitHub",
        href: "https://github.com/kumaraswamy-barapati",
      },
    ],
  },
  {
    name: "Dalbir Singh",
    role: "Full-Stack Developer",
    photo: "assets/new/Dalbir.svg",
    socials: [
      {
        icon: "linkedin",
        label: "Dalbir Singh on LinkedIn",
        href: "https://linkedin.com/in/dalbir-singh-tech",
      },
      {
        icon: "github",
        label: "Dalbir Singh on GitHub",
        href: "https://github.com/dalbirSodhi",
      },
    ],
  },
  {
    name: "Amritpal Singh",
    role: "Full-Stack Developer",
    photo: "assets/new/Amritpal.svg",
    socials: [
      {
        icon: "linkedin",
        label: "Amritpal Singh on LinkedIn",
        href: "https://linkedin.com/in/amritpal-singh-tech",
      },
      {
        icon: "github",
        label: "Amritpal Singh on GitHub",
        href: "https://github.com/Amritpalx",
      },
    ],
  },

  {
    name: "Deep Patel",
    role: "Full-Stack Developer",
    photo: "assets/new/Deep.svg",
    socials: [
      {
        icon: "linkedin",
        label: "Deep Patel on LinkedIn",
        href: "https://linkedin.com/in/deep-patel-tech",
      },
      {
        icon: "github",
        label: "Deep Patel on GitHub",
        href: "https://github.com/deep-patel-tech",
      },
    ],
  },
];

const TEAM_SOCIAL_ICON = {
  linkedin: "assets/new/linkedIn-member.svg",
  github: "assets/new/github-member.svg",
  behance: "assets/new/behance-member.svg",
  globe: "assets/icons/globe.svg",
};

function renderTeam() {
  const grid = document.querySelector("#team-grid");
  if (!grid) return;

  grid.innerHTML = TEAM.map((member) => {
    const socials = member.socials
      .map(
        (social) => `
        <a href="${social.href}" target="_blank" rel="noreferrer" aria-label="${social.label}">
          <img src="${TEAM_SOCIAL_ICON[social.icon]}" alt="" />
        </a>`,
      )
      .join("");

    return `
      <article class="team-card reveal" role="listitem">
        <div class="team-photo-wrap">
          <img class="team-photo" src="${member.photo}" alt="${member.name}" loading="lazy" />
        </div>
        <strong>${member.name}</strong>
        <span class="role">${member.role}</span>
        <div class="team-socials">${socials}</div>
      </article>`;
  }).join("");
}

function wirePlaceholders() {
  document.querySelectorAll("img[data-ph]").forEach((img) => {
    const flag = () => img.classList.add("is-placeholder");
    const check = () => {
      if (!img.complete) return;
      if (img.naturalWidth === 0 || img.naturalHeight === 0) flag();
    };
    img.addEventListener("error", flag);
    img.addEventListener("load", check);
    check();
  });
}

function init() {
  renderTeam();
  wirePlaceholders();

  const header = document.querySelector(".site-header");
  const menuButton = document.querySelector(".menu-button");
  const navigation = document.querySelector(".primary-nav");
  const contactForm = document.querySelector(".contact-form");
  const formStatus = document.querySelector(".form-status");

  const closeMenu = () => {
    menuButton?.setAttribute("aria-expanded", "false");
    navigation?.classList.remove("open");
  };

  menuButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    navigation?.classList.toggle("open", !isOpen);
  });

  document.addEventListener("click", (event) => {
    if (window.innerWidth > 420 || !navigation?.classList.contains("open"))
      return;
    if (!header?.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  navigation?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 420) closeMenu();
  });

  window.addEventListener(
    "scroll",
    () => {
      header?.classList.toggle("scrolled", window.scrollY > 24);
    },
    { passive: true },
  );

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12 },
  );
  document
    .querySelectorAll(".reveal")
    .forEach((el) => revealObserver.observe(el));

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
      formStatus.textContent =
        "Please complete every field with a valid email address.";
      return;
    }

    const data = new FormData(contactForm);
    const subject = encodeURIComponent(`[FixBee] ${data.get("subject")}`);
    const body = encodeURIComponent(
      `Name: ${data.get("name")}\nEmail: ${data.get("email")}\n\n${data.get("message")}`,
    );

    formStatus.textContent = "Opening your email app...";
    window.location.href = `mailto:capstonet01@gmail.com?subject=${subject}&body=${body}`;
  });

  document.querySelectorAll("[data-current-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
