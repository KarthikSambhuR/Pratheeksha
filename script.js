document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.testimonial-slides .slide');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    let currentSlide = 0;

    function showSlide(index) {
        // Ensure index is within bounds
        if (index >= slides.length) {
            index = 0;
        } else if (index < 0) {
            index = slides.length - 1;
        }

        // Hide all slides
        slides.forEach(slide => {
            slide.classList.remove('active');
        });

        // Show the target slide
        slides[index].classList.add('active');
        currentSlide = index;
    }

    // Event Listeners for buttons
    nextBtn.addEventListener('click', () => {
        showSlide(currentSlide + 1);
    });

    prevBtn.addEventListener('click', () => {
        showSlide(currentSlide - 1);
    });

    // Initial display
    if (slides.length > 0) {
        showSlide(0);
    }
});