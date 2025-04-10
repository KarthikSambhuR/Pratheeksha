document.addEventListener('DOMContentLoaded', () => {

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

    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mainNav = document.getElementById('main-navigation');
    const body = document.body;

    function closeMobileMenu() {
        mainNav.classList.remove('mobile-nav-active');
        hamburgerBtn.classList.remove('active');
        body.classList.remove('no-scroll');
        hamburgerBtn.setAttribute('aria-expanded', 'false'); 
    }

    function toggleMobileMenu() {
        const isActive = mainNav.classList.toggle('mobile-nav-active');
        hamburgerBtn.classList.toggle('active');
        body.classList.toggle('no-scroll');
        hamburgerBtn.setAttribute('aria-expanded', isActive ? 'true' : 'false'); 
    }

    if (hamburgerBtn && mainNav) {

        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            toggleMobileMenu();
        });

        const navLinks = mainNav.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {

                if (mainNav.classList.contains('mobile-nav-active')) {
                    closeMobileMenu();
                }
            });
        });

        document.addEventListener('click', (event) => {

            if (mainNav.classList.contains('mobile-nav-active') &&
                !mainNav.contains(event.target) &&
                !hamburgerBtn.contains(event.target)) {
                closeMobileMenu();
            }
        });

        mainNav.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    const scrollTopBtn = document.getElementById('scrollToTopBtn');
    const scrollThreshold = 200; 

    function toggleScrollTopButton() {
        if (!scrollTopBtn) return; 

        if (window.pageYOffset > scrollThreshold || document.documentElement.scrollTop > scrollThreshold) {
            scrollTopBtn.classList.add('show');
        } else {
            scrollTopBtn.classList.remove('show');
        }
    }

    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    if (scrollTopBtn) {

        window.addEventListener('scroll', toggleScrollTopButton);

        scrollTopBtn.addEventListener('click', scrollToTop);

        toggleScrollTopButton();
    }
});