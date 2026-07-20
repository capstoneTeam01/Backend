const TEAM = [
  {
    name: "Anmol Singh",
    role: "Full-Stack Developer (PM)",
    photo: "assets/anmol.png",
    badge: "PM",
    socials: [
      {
        icon: "linkedin",
        label: "/anmol-singh-tech",
        href: "https://linkedin.com/in/anmol-singh-tech",
      },
      {
        icon: "github",
        label: "/anmolss-tech",
        href: "https://github.com/anmolss-tech",
      },
    ],
  },
  {
    name: "Kumara Swamy",
    role: "Full-Stack Developer (Lead)",
    photo: "assets/kumara.png",
    badge: "Lead",
    socials: [
      {
        icon: "linkedin",
        label: "/kumaraswamy-barapati",
        href: "https://linkedin.com/in/kumaraswamy-barapati",
      },
      {
        icon: "github",
        label: "/kumaraswamy-barapati",
        href: "https://github.com/kumaraswamy-barapati",
      },
    ],
  },
  {
    name: "Ankit Kate",
    role: "UI/UX Designer (Co-Lead)",
    photo: "assets/ankit.png",
    badge: "Co-Lead",
    socials: [
      {
        icon: "linkedin",
        label: "/ankitkate",
        href: "https://linkedin.com/in/ankitkate",
      },
      {
        icon: "globe",
        label: "www.ankitkate.com",
        href: "https://www.ankitkate.com",
      },
    ],
  },
  {
    name: "Theertha Vinod",
    role: "UI/UX Designer (Co-Lead)",
    photo: "assets/theertha.png",
    badge: "Co-Lead",
    socials: [
      {
        icon: "linkedin",
        label: "/theerthaavinod",
        href: "https://linkedin.com/in/theerthaavinod",
      },
      {
        icon: "globe",
        label: "www.theerthavinod.com",
        href: "https://www.theerthavinod.com",
      },
    ],
  },
  {
    name: "Dalbir Singh",
    role: "Full-Stack Developer",
    photo: "assets/dalbir.png",
    badge: "",
    socials: [
      {
        icon: "linkedin",
        label: "/dalbir-singh-tech",
        href: "https://linkedin.com/in/dalbir-singh-tech",
      },
      {
        icon: "github",
        label: "/dalbirSodhi",
        href: "https://github.com/dalbirSodhi",
      },
    ],
  },
  {
    name: "Amritpal Singh",
    role: "Full-Stack Developer",
    photo: "assets/amritpal.png",
    badge: "",
    socials: [
      {
        icon: "linkedin",
        label: "/amritpal-singh-tech",
        href: "https://linkedin.com/in/amritpal-singh-tech",
      },
      {
        icon: "github",
        label: "/Amritpalx",
        href: "https://github.com/Amritpalx",
      },
    ],
  },
  {
    name: "Deep Patel",
    role: "Full-Stack Developer",
    photo: "assets/deep.png",
    badge: "",
    socials: [
      {
        icon: "linkedin",
        label: "/deep-patel-tech",
        href: "https://linkedin.com/in/deep-patel-tech",
      },
      {
        icon: "github",
        label: "/deep-patel-tech",
        href: "https://github.com/deep-patel-tech",
      },
    ],
  },
  {
    name: "Mekhala Mannapatt",
    role: "UI/UX Designer",
    photo: "assets/mekhala.png",
    badge: "",
    socials: [
      {
        icon: "linkedin",
        label: "/mekhalamanappatt",
        href: "https://linkedin.com/in/mekhalamanappatt",
      },
      {
        icon: "behance",
        label: "/mekhalamuraly",
        href: "https://behance.net/mekhalamuraly",
      },
    ],
  },
];

function renderTeam() {
  const grid = document.querySelector("#team-grid");
  if (!grid) return;

  grid.innerHTML = TEAM.map((m) => {
    const badge = m.badge ? `<span class="team-badge">${m.badge}</span>` : "";
    const socials = m.socials
      .map(
        (s) => `
        <a href="${s.href}" target="_blank" rel="noreferrer" aria-label="${s.icon}">
          <img src="assets/icons/${s.icon}.svg" alt="${s.icon}" />
        </a>`,
      )
      .join("");

    return `
      <article class="team-card reveal" role="listitem">
        <div class="team-photo-wrap">
          ${badge}
          <img class="team-photo" src="${m.photo}" alt="${m.name}" loading="lazy" />
        </div>
        <strong>${m.name}</strong>
        <span class="role">${m.role}</span>
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
    window.location.href = `mailto:fixbee.team@gmail.com?subject=${subject}&body=${body}`;
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
