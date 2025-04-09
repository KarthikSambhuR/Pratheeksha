document.addEventListener('DOMContentLoaded', () => {
    // --- Testimonial Slider Logic ---
    const slides = document.querySelectorAll('.testimonial-slides .slide');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    let currentSlide = 0;

    function showSlide(index) {
        if (slides.length === 0) return;
        if (index >= slides.length) {
            index = 0;
        } else if (index < 0) {
            index = slides.length - 1;
        }
        slides.forEach(slide => slide.classList.remove('active'));
        slides[index].classList.add('active');
        currentSlide = index;
    }

    if (nextBtn && prevBtn) {
        nextBtn.addEventListener('click', () => showSlide(currentSlide + 1));
        prevBtn.addEventListener('click', () => showSlide(currentSlide - 1));
    }

    if (slides.length > 0) {
        showSlide(0);
    }

    // --- Hamburger Menu Logic ---
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mainNav = document.getElementById('main-navigation');
    const body = document.body;

    // Function to close the mobile menu
    function closeMobileMenu() {
        mainNav.classList.remove('mobile-nav-active');
        hamburgerBtn.classList.remove('active');
        body.classList.remove('no-scroll');
        hamburgerBtn.setAttribute('aria-expanded', 'false'); // Update aria attribute
    }

    // Function to toggle the mobile menu
    function toggleMobileMenu() {
        const isActive = mainNav.classList.toggle('mobile-nav-active');
        hamburgerBtn.classList.toggle('active');
        body.classList.toggle('no-scroll');
        hamburgerBtn.setAttribute('aria-expanded', isActive ? 'true' : 'false'); // Update aria attribute
    }

    if (hamburgerBtn && mainNav) {
        // Toggle menu on hamburger click
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent click from immediately triggering the document listener
            toggleMobileMenu();
        });

        // Close menu when a link inside the nav is clicked
        const navLinks = mainNav.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                // Only close if the menu is actually active (it should be if a link is clicked)
                if (mainNav.classList.contains('mobile-nav-active')) {
                    closeMobileMenu();
                }
            });
        });

        // Close menu when clicking outside the menu
        document.addEventListener('click', (event) => {
            // Check if the menu is active and the click was outside the nav and outside the hamburger
            if (mainNav.classList.contains('mobile-nav-active') &&
                !mainNav.contains(event.target) &&
                !hamburgerBtn.contains(event.target)) {
                closeMobileMenu();
            }
        });

        // Prevent clicks inside the menu from closing it (due to event propagation)
        mainNav.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
});