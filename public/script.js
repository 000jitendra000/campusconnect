document.addEventListener("DOMContentLoaded", function () {
    const menuToggle = document.getElementById("menu-toggle");
    const mainNav = document.getElementById("main-nav");
    const dayContent = document.getElementById("day-content");
    const dayTabs = document.querySelectorAll(".day-tab");
    const backendStatus = document.getElementById("backend-status");

    const eventList = document.getElementById("event-list");
    const searchInput = document.getElementById("event-search");
    const categoryFilter = document.getElementById("event-filter");
    const addEventForm = document.getElementById("add-event-form");
    const formMessage = document.getElementById("form-message");

    let databaseEvents = [];

    // Mobile navigation
    if (menuToggle && mainNav) {
        menuToggle.addEventListener("click", function () {
            const isOpen = mainNav.classList.toggle("open");
            menuToggle.setAttribute("aria-expanded", String(isOpen));
            menuToggle.textContent = isOpen ? "✕" : "☰";
        });

        mainNav.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", function () {
                mainNav.classList.remove("open");
                menuToggle.setAttribute("aria-expanded", "false");
                menuToggle.textContent = "☰";
            });
        });
    }

    // Mohana Mantra festival schedule
    const schedule = {
        "1": {
            title: "Day 1 — The Grand Opening",
            items: [
                ["09:00 AM", "Inauguration Ceremony", "Opening celebration and welcome address."],
                ["11:00 AM", "Technical Kickoff", "Innovation challenges and coding activities."],
                ["02:00 PM", "Creative Arena", "Fun activities and student competitions."],
                ["05:00 PM", "Cultural Showcase", "Music, dance and student performances."]
            ]
        },
        "2": {
            title: "Day 2 — Innovation & Talent",
            items: [
                ["09:30 AM", "AI Innovation Challenge", "Showcase ideas using technology."],
                ["11:30 AM", "Web Development Workshop", "Learn through practical website building."],
                ["02:00 PM", "Sports & Games", "Friendly campus competitions."],
                ["05:00 PM", "Talent Stage", "Performances by talented students."]
            ]
        },
        "3": {
            title: "Day 3 — The Grand Finale",
            items: [
                ["09:30 AM", "Final Round", "Final presentations and competitions."],
                ["12:00 PM", "Project Showcase", "Discover student projects and ideas."],
                ["03:00 PM", "Prize Distribution", "Celebrate competition winners."],
                ["05:00 PM", "Closing Celebration", "A memorable festival finale."]
            ]
        }
    };

    function renderSchedule(day) {
        if (!dayContent || !schedule[day]) return;

        const data = schedule[day];
        dayContent.replaceChildren();

        const heading = document.createElement("h3");
        heading.textContent = data.title;
        dayContent.appendChild(heading);

        data.items.forEach(function (item) {
            const row = document.createElement("div");
            row.className = "schedule-item";

            const time = document.createElement("span");
            time.className = "schedule-time";
            time.textContent = item[0];

            const details = document.createElement("div");
            const title = document.createElement("h4");
            title.textContent = item[1];

            const description = document.createElement("p");
            description.textContent = item[2];

            details.append(title, description);
            row.append(time, details);
            dayContent.appendChild(row);
        });
    }

    dayTabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            dayTabs.forEach(function (otherTab) {
                otherTab.classList.remove("active");
                otherTab.setAttribute("aria-selected", "false");
            });

            tab.classList.add("active");
            tab.setAttribute("aria-selected", "true");

            renderSchedule(tab.dataset.day);
        });
    });

    if (dayTabs.length > 0) {
        const activeTab = document.querySelector(".day-tab.active") || dayTabs[0];
        renderSchedule(activeTab.dataset.day || "1");
    }

    // API helper
    async function apiRequest(url, options) {
        const response = await fetch(url, {
            credentials: "same-origin",
            ...(options || {}),
            headers: {
                ...((options && options.headers) || {}),
                ...(options && options.body
                    ? { "Content-Type": "application/json" }
                    : {})
            }
        });

        const data = await response.json().catch(function () {
            return {};
        });

        if (!response.ok) {
            const error = new Error(
                data.error || "Request failed. Please try again."
            );
            error.status = response.status;
            throw error;
        }

        return data;
    }

    // Backend status
    async function checkBackend() {
        if (!backendStatus) return;

        try {
            await apiRequest("/api");
            backendStatus.textContent = "● Backend connected";
            backendStatus.classList.add("connected");
            backendStatus.classList.remove("disconnected");
        } catch (error) {
            backendStatus.textContent = "● Backend unavailable";
            backendStatus.classList.add("disconnected");
            backendStatus.classList.remove("connected");
        }
    }

    // Registration form displayed inside an event card
    function showRegistrationForm(eventId, card) {
        const oldForm = card.querySelector(".registration-form");

        if (oldForm) {
            oldForm.remove();
            return;
        }

        const form = document.createElement("form");
        form.className = "registration-form";

        const heading = document.createElement("h4");
        heading.textContent = "Register for this event";

        const nameLabel = document.createElement("label");
        nameLabel.textContent = "Your name";

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.name = "student_name";
        nameInput.placeholder = "Enter your full name";
        nameInput.maxLength = 100;
        nameInput.required = true;

        const emailLabel = document.createElement("label");
        emailLabel.textContent = "Email address";

        const emailInput = document.createElement("input");
        emailInput.type = "email";
        emailInput.name = "student_email";
        emailInput.placeholder = "you@example.com";
        emailInput.maxLength = 254;
        emailInput.required = true;

        const submitButton = document.createElement("button");
        submitButton.type = "submit";
        submitButton.textContent = "Confirm Registration";

        const message = document.createElement("p");
        message.className = "registration-message";
        message.setAttribute("role", "status");

        form.append(
            heading,
            nameLabel,
            nameInput,
            emailLabel,
            emailInput,
            submitButton,
            message
        );

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            submitButton.disabled = true;
            message.textContent = "Submitting registration...";

            try {
                const result = await apiRequest(
                    "/api/events/" + encodeURIComponent(eventId) + "/register",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            student_name: nameInput.value.trim(),
                            student_email: emailInput.value.trim()
                        })
                    }
                );

                message.textContent = result.message || "Registration successful!";
                form.reset();
            } catch (error) {
                message.textContent = error.message;
            } finally {
                submitButton.disabled = false;
            }
        });

        card.appendChild(form);
        nameInput.focus();
    }

    // Render events returned by the database
    function renderEvents() {
        if (!eventList) return;

        eventList.replaceChildren();

        const searchTerm = searchInput
            ? searchInput.value.trim().toLowerCase()
            : "";

        const selectedCategory = categoryFilter
            ? categoryFilter.value.toLowerCase()
            : "all";

        const filteredEvents = databaseEvents.filter(function (event) {
            const matchesSearch =
                String(event.title || "").toLowerCase().includes(searchTerm) ||
                String(event.description || "").toLowerCase().includes(searchTerm) ||
                String(event.category || "").toLowerCase().includes(searchTerm);

            const matchesCategory =
                selectedCategory === "all" ||
                String(event.category || "").toLowerCase() === selectedCategory;

            return matchesSearch && matchesCategory;
        });

        if (filteredEvents.length === 0) {
            const empty = document.createElement("p");
            empty.className = "empty-events";
            empty.textContent = databaseEvents.length
                ? "No events match your search. Try another keyword or category."
                : "No database events yet. Check back soon!";
            eventList.appendChild(empty);
            return;
        }

        filteredEvents.forEach(function (event) {
            const card = document.createElement("article");
            card.className = "event-card database-event-card";

            const category = document.createElement("span");
            category.className = "event-category";
            category.textContent = event.category || "Campus Event";

            const title = document.createElement("h3");
            title.textContent = event.title;

            const description = document.createElement("p");
            description.textContent = event.description;

            const registerButton = document.createElement("button");
            registerButton.type = "button";
            registerButton.className = "register-button";
            registerButton.textContent = "Register Now";

            registerButton.addEventListener("click", function () {
                showRegistrationForm(event.id, card);
            });

            card.append(category, title, description, registerButton);
            eventList.appendChild(card);
        });
    }

    // Load events
    async function loadEvents() {
        if (!eventList) return;

        try {
            const events = await apiRequest("/api/events");
            databaseEvents = Array.isArray(events) ? events : [];
            renderEvents();
        } catch (error) {
            eventList.replaceChildren();

            const message = document.createElement("p");
            message.textContent =
                "Could not load events. Please make sure the server is running.";
            eventList.appendChild(message);
        }
    }

    if (searchInput) {
        searchInput.addEventListener("input", renderEvents);
    }

    if (categoryFilter) {
        categoryFilter.addEventListener("change", renderEvents);
    }

    // Admin-only event creation. Students must log in as admin first.
    if (addEventForm) {
        addEventForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const titleInput = document.getElementById("event-title");
            const categoryInput = document.getElementById("event-category");
            const descriptionInput = document.getElementById("event-description");

            if (!titleInput || !categoryInput || !descriptionInput) {
                if (formMessage) {
                    formMessage.textContent =
                        "Event form fields were not found. Check the IDs in index.html.";
                }
                return;
            }

            if (formMessage) {
                formMessage.textContent = "Creating event...";
            }

            const submitButton = addEventForm.querySelector(
                'button[type="submit"], input[type="submit"]'
            );

            if (submitButton) submitButton.disabled = true;

            try {
                const result = await apiRequest("/api/events", {
                    method: "POST",
                    body: JSON.stringify({
                        title: titleInput.value.trim(),
                        category: categoryInput.value,
                        description: descriptionInput.value.trim()
                    })
                });

                if (formMessage) {
                    formMessage.textContent =
                        result.message || "Event created successfully!";
                }

                addEventForm.reset();
                await loadEvents();
            } catch (error) {
                if (formMessage) {
                    formMessage.textContent = error.status === 401
                        ? "Only an admin can create events. Log in at /admin-login.html first."
                        : error.message;
                }
            } finally {
                if (submitButton) submitButton.disabled = false;
            }
        });
    }

    checkBackend();
    loadEvents();
});