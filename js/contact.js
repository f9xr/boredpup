/* BoredPuP - contact form. Composes a mailto: so there is no server to abuse. */

const CONTACT_ADDRESS = "tontufytservices@gmail.com";

const TOPICS = {
  broken: "Broken game report",
  feedback: "Feedback",
  copyright: "Copyright / takedown request",
  privacy: "Privacy concern",
  other: "General inquiry",
};

const typeSelect = document.getElementById("contactType");
const msg = document.getElementById("contactMessage");
const sendBtn = document.getElementById("sendBtn");

if (sendBtn) {
  sendBtn.addEventListener("click", () => {
    const topic = (typeSelect && typeSelect.value) || "other";
    const subject = `[BoredPuP] ${TOPICS[topic] || "Contact"}`;
    const body = msg && msg.value.trim() ? msg.value.trim() : "(no message)";
    window.location.href = `mailto:${CONTACT_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}
