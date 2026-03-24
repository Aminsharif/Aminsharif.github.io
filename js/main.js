// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initThemeToggle();
    initScrollAnimations();
    initContactForm();
    initSmoothScrolling();
    initCardInteraction();
});

// Navigation functionality
function initNavigation() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const navbar = document.getElementById('navbar');

    // Mobile menu toggle
    navToggle.addEventListener('click', function() {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    });

    // Close mobile menu when clicking on a link
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
        });
    });

    // Navbar scroll effect
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.style.backgroundColor = 'var(--bg-primary)';
            navbar.style.boxShadow = 'var(--shadow-md)';
        } else {
            navbar.style.backgroundColor = 'var(--bg-primary)';
            navbar.style.boxShadow = 'none';
        }
    });

    // Active navigation link highlighting
    window.addEventListener('scroll', function() {
        let current = '';
        const sections = document.querySelectorAll('section');
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (window.scrollY >= (sectionTop - 200)) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

// Theme toggle functionality
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme') || 'light';
    body.setAttribute('data-theme', savedTheme);
    
    themeToggle.addEventListener('click', function() {
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Add a subtle animation to the theme toggle
        themeToggle.style.transform = 'scale(0.9)';
        setTimeout(() => {
            themeToggle.style.transform = 'scale(1)';
        }, 150);
    });
}

// Scroll animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.project-card, .blog-card, .skill-category, .about-text, .contact-info, .contact-form');
    animatedElements.forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });

    // Stagger animation for project cards
    const projectCards = document.querySelectorAll('.project-card');
    projectCards.forEach((card, index) => {
        setTimeout(() => {
            card.style.animationDelay = `${index * 0.2}s`;
            card.style.animation = 'fadeInUp 0.6s ease forwards';
        }, 100);
    });

    // Stagger animation for blog cards
    const blogCards = document.querySelectorAll('.blog-card');
    blogCards.forEach((card, index) => {
        setTimeout(() => {
            card.style.animationDelay = `${index * 0.2}s`;
            card.style.animation = 'fadeInUp 0.6s ease forwards';
        }, 100);
    });
}

// Contact form functionality
function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    if (!contactForm) {
        return;
    }
    
    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(contactForm);
        const name = formData.get('name');
        const email = formData.get('email');
        const message = formData.get('message');
        
        if (!name || !email || !message) {
            showNotification('Please fill in all fields.', 'error');
            return;
        }
        
        if (!isValidEmail(email)) {
            showNotification('Please enter a valid email address.', 'error');
            return;
        }
        
        const submitButton = contactForm.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        
        submitButton.textContent = 'Sending...';
        submitButton.disabled = true;
        
        try {
            const response = await fetch(contactForm.action, {
                method: 'POST',
                body: formData,
                headers: {
                    Accept: 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            showNotification('Thank you for your message! I will get back to you soon.', 'success');
            contactForm.reset();
        } catch (error) {
            showNotification('Unable to send right now. Please email directly: sharifmia236@gmail.com', 'error');
        } finally {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    });
}

// Smooth scrolling for navigation links
function initSmoothScrolling() {
    const navLinks = document.querySelectorAll('a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const offsetTop = targetSection.offsetTop - 70; // Account for fixed navbar
                
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Utility functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '1rem 1.5rem',
        borderRadius: '8px',
        color: 'white',
        fontWeight: '500',
        zIndex: '9999',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease',
        maxWidth: '300px',
        wordWrap: 'break-word'
    });
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#10b981';
            break;
        case 'error':
            notification.style.backgroundColor = '#ef4444';
            break;
        default:
            notification.style.backgroundColor = '#3b82f6';
    }
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Typing animation for hero section
function initTypingAnimation() {
    const heroSubtitle = document.querySelector('.hero-subtitle');
    const text = 'Former Software Engineer turned Data Scientist';
    const typingSpeed = 50;
    
    if (heroSubtitle) {
        heroSubtitle.textContent = '';
        let i = 0;
        
        function typeWriter() {
            if (i < text.length) {
                heroSubtitle.textContent += text.charAt(i);
                i++;
                setTimeout(typeWriter, typingSpeed);
            }
        }
        
        // Start typing animation after hero content loads
        setTimeout(typeWriter, 1000);
    }
}

// Initialize typing animation when page loads
window.addEventListener('load', function() {
    initTypingAnimation();
});

// Parallax effect for hero section
function initParallaxEffect() {
    const hero = document.querySelector('.hero');
    
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const rate = scrolled * -0.5;
        
        if (hero) {
            hero.style.transform = `translateY(${rate}px)`;
        }
    });
}

// Add scroll-to-top button
function initScrollToTop() {
    // Create scroll to top button
    const scrollToTopBtn = document.createElement('button');
    scrollToTopBtn.innerHTML = '↑';
    scrollToTopBtn.className = 'scroll-to-top';
    
    // Style the button
    Object.assign(scrollToTopBtn.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        backgroundColor: 'var(--primary-color)',
        color: 'white',
        border: 'none',
        fontSize: '20px',
        cursor: 'pointer',
        opacity: '0',
        visibility: 'hidden',
        transition: 'all 0.3s ease',
        zIndex: '1000',
        boxShadow: 'var(--shadow-lg)'
    });
    
    document.body.appendChild(scrollToTopBtn);
    
    // Show/hide button based on scroll position
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            scrollToTopBtn.style.opacity = '1';
            scrollToTopBtn.style.visibility = 'visible';
        } else {
            scrollToTopBtn.style.opacity = '0';
            scrollToTopBtn.style.visibility = 'hidden';
        }
    });
    
    // Scroll to top when clicked
    scrollToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Initialize additional features
window.addEventListener('load', function() {
    initScrollToTop();
    // Uncomment the line below if you want parallax effect
    // initParallaxEffect();
});

// Performance optimization: Debounce scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Apply debouncing to scroll events for better performance
const debouncedScrollHandler = debounce(function() {
    // Any scroll-based functionality can be added here
}, 10);

window.addEventListener('scroll', debouncedScrollHandler);


function initStatsCounter() {
    const stats = {
        'Years Experience': 5,
        'Projects Completed': 25,
        'Technologies Mastered': 15,
        'Certifications': 3
    };
    
    const statsContainer = document.createElement('div');
    statsContainer.className = 'stats-container';
    
    Object.entries(stats).forEach(([label, value]) => {
        const statItem = document.createElement('div');
        statItem.className = 'stat-item';
        statItem.innerHTML = `
            <div class="stat-number" data-target="${value}">0</div>
            <div class="stat-label">${label}</div>
        `;
        statsContainer.appendChild(statItem);
    });
    
    // Animate counters when in view
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
            }
        });
    });
    
    observer.observe(statsContainer);
    
    // Insert stats into about section
    const aboutSection = document.querySelector('.about-content');
    aboutSection.appendChild(statsContainer);
}

function animateCounter(element) {
    const target = parseInt(element.dataset.target);
    const duration = 2000;
    const step = target / (duration / 16);
    let current = 0;
    
    const timer = setInterval(() => {
        current += step;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current);
    }, 16);
}

function initAdvancedThemeToggle() {
    const themes = {
        light: {
            '--primary-color': '#3b82f6',
            '--bg-primary': '#ffffff',
            '--text-primary': '#1f2937'
        },
        dark: {
            '--primary-color': '#60a5fa',
            '--bg-primary': '#1f2937',
            '--text-primary': '#f9fafb'
        },
        blue: {
            '--primary-color': '#1e40af',
            '--bg-primary': '#eff6ff',
            '--text-primary': '#1e3a8a'
        }
    };
    
    function applyTheme(themeName) {
        const theme = themes[themeName];
        const root = document.documentElement;
        
        Object.entries(theme).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });
        
        localStorage.setItem('selectedTheme', themeName);
    }
    
    // Create theme selector
    const themeSelector = document.createElement('select');
    themeSelector.className = 'theme-selector';
    
    Object.keys(themes).forEach(themeName => {
        const option = document.createElement('option');
        option.value = themeName;
        option.textContent = themeName.charAt(0).toUpperCase() + themeName.slice(1);
        themeSelector.appendChild(option);
    });
    
    themeSelector.addEventListener('change', (e) => {
        applyTheme(e.target.value);
    });
    
    document.querySelector('.nav-container').appendChild(themeSelector);
}

// Add this to your existing main.js file

// Dynamic GitHub Projects Loading
async function loadGitHubProjects() {
    const projectsGrid = document.querySelector('.projects-grid');
    const loadingIndicator = createLoadingIndicator();
    
    // Show loading state
    projectsGrid.innerHTML = '';
    projectsGrid.appendChild(loadingIndicator);
    
    try {
        const response = await fetch('https://api.github.com/users/aminsharif/repos?sort=updated&per_page=9');
        const repos = await response.json();
        
        // Clear loading indicator
        projectsGrid.innerHTML = '';
        
        // Filter and display projects
        const featuredRepos = repos.filter(repo => 
            !repo.fork && 
            repo.description && 
            (repo.stargazers_count > 0 || repo.language)
        ).slice(0, 6);
        
        if (featuredRepos.length === 0) {
            projectsGrid.appendChild(createNoProjectsMessage());
            return;
        }
        
        featuredRepos.forEach((repo, index) => {
            const projectCard = createProjectCard(repo);
            projectCard.style.animationDelay = `${index * 0.1}s`;
            projectsGrid.appendChild(projectCard);
        });
        
        // Re-initialize scroll animations for new cards
        initProjectAnimations();
        
    } catch (error) {
        console.error('Error loading GitHub projects:', error);
        projectsGrid.innerHTML = '';
        projectsGrid.appendChild(createErrorMessage());
    }
}

function createProjectCard(repo) {
    const card = document.createElement('article');
    card.className = 'project-card fade-in';
    
    // Determine project category based on language and topics
    const category = getProjectCategory(repo);
    const techTags = getProjectTechTags(repo);
    
    card.innerHTML = `
        <div class="project-image">
            <div class="project-placeholder">${category.icon}</div>
            <div class="project-overlay">
                <div class="project-stats">
                    <span class="stat">⭐ ${repo.stargazers_count}</span>
                    <span class="stat">🍴 ${repo.forks_count}</span>
                    ${repo.language ? `<span class="stat">${repo.language}</span>` : ''}
                </div>
            </div>
        </div>
        <div class="project-content">
            <h3 class="project-title">${formatProjectTitle(repo.name)}</h3>
            <p class="project-description">
                ${repo.description || 'A showcase of modern development practices and clean code architecture.'}
            </p>
            <div class="project-tech">
                ${techTags.map(tag => `<span class="tech-tag">${tag}</span>`).join('')}
            </div>
            <div class="project-links">
                <a href="${repo.html_url}" class="project-link" target="_blank" rel="noopener">View Code</a>
                ${repo.homepage ? `<a href="${repo.homepage}" class="project-link" target="_blank" rel="noopener">Live Demo</a>` : ''}
            </div>
            <div class="project-meta">
                <span class="project-date">Updated: ${new Date(repo.updated_at).toLocaleDateString()}</span>
            </div>
        </div>
    `;
    
    return card;
}

function getProjectCategory(repo) {
    const name = repo.name.toLowerCase();
    const description = (repo.description || '').toLowerCase();
    const language = (repo.language || '').toLowerCase();
    const topics = repo.topics || [];
    
    if (topics.includes('machine-learning') || topics.includes('ai') || 
        description.includes('machine learning') || description.includes('ai') ||
        name.includes('ml') || name.includes('ai')) {
        return { icon: '🤖', category: 'AI/ML' };
    }
    
    if (topics.includes('web-scraping') || topics.includes('scraping') ||
        description.includes('scraping') || description.includes('crawler') ||
        name.includes('scraper') || name.includes('scraping')) {
        return { icon: '🕷️', category: 'Web Scraping' };
    }
    
    if (language === 'python' || topics.includes('data-science') ||
        description.includes('data') || name.includes('data')) {
        return { icon: '📊', category: 'Data Science' };
    }
    
    if (language === 'javascript' || language === 'typescript' ||
        topics.includes('web') || topics.includes('frontend')) {
        return { icon: '🌐', category: 'Web Dev' };
    }
    
    if (language === 'c#' || topics.includes('dotnet') ||
        description.includes('.net') || name.includes('dotnet')) {
        return { icon: '⚡', category: '.NET' };
    }
    
    return { icon: '💻', category: 'Code' };
}

function getProjectTechTags(repo) {
    const tags = [];
    
    if (repo.language) {
        tags.push(repo.language);
    }
    
    // Add relevant topics as tech tags
    const relevantTopics = (repo.topics || []).filter(topic => 
        ['react', 'angular', 'vue', 'nodejs', 'python', 'javascript', 
         'typescript', 'machine-learning', 'ai', 'data-science', 
         'web-scraping', 'api', 'database', 'mongodb', 'postgresql'].includes(topic)
    );
    
    tags.push(...relevantTopics);
    
    // Add stars if significant
    if (repo.stargazers_count > 0) {
        tags.push(`⭐ ${repo.stargazers_count}`);
    }
    
    return tags.slice(0, 4); // Limit to 4 tags for clean display
}

function formatProjectTitle(name) {
    return name
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function createLoadingIndicator() {
    const loading = document.createElement('div');
    loading.className = 'loading-projects';
    loading.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Loading projects from GitHub...</p>
    `;
    return loading;
}

function createNoProjectsMessage() {
    const message = document.createElement('div');
    message.className = 'no-projects-message';
    message.innerHTML = `
        <div class="message-icon">📁</div>
        <h3>No Projects Found</h3>
        <p>Projects will appear here once they're available on GitHub.</p>
        <a href="https://github.com/aminsharif" class="btn btn-primary" target="_blank">Visit GitHub Profile</a>
    `;
    return message;
}

function createErrorMessage() {
    const error = document.createElement('div');
    error.className = 'error-message';
    error.innerHTML = `
        <div class="message-icon">⚠️</div>
        <h3>Unable to Load Projects</h3>
        <p>There was an issue loading projects from GitHub. Please try again later.</p>
        <button class="btn btn-secondary" onclick="loadGitHubProjects()">Retry</button>
    `;
    return error;
}

function initProjectAnimations() {
    const projectCards = document.querySelectorAll('.project-card');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    projectCards.forEach(card => {
        observer.observe(card);
    });
}

// Add project filtering functionality
function initProjectFilters() {
    const projectsSection = document.querySelector('#projects .container');
    const filtersContainer = document.createElement('div');
    filtersContainer.className = 'project-filters';
    
    const filters = ['All', 'AI/ML', 'Web Dev', 'Data Science', 'Web Scraping', '.NET'];
    
    filtersContainer.innerHTML = `
        <div class="filter-buttons">
            ${filters.map(filter => 
                `<button class="filter-btn ${filter === 'All' ? 'active' : ''}" data-filter="${filter}">${filter}</button>`
            ).join('')}
        </div>
    `;
    
    // Insert filters before projects grid
    const projectsGrid = document.querySelector('.projects-grid');
    projectsSection.insertBefore(filtersContainer, projectsGrid);
    
    // Add filter functionality
    const filterButtons = filtersContainer.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            
            // Update active button
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Filter projects
            filterProjects(filter);
        });
    });
}

function filterProjects(filter) {
    const projectCards = document.querySelectorAll('.project-card');
    
    projectCards.forEach(card => {
        const category = card.querySelector('.project-placeholder').textContent;
        
        if (filter === 'All' || category.includes(getCategoryIcon(filter))) {
            card.style.display = 'block';
            card.classList.add('fade-in');
        } else {
            card.style.display = 'none';
        }
    });
}

function getCategoryIcon(filter) {
    const icons = {
        'AI/ML': '🤖',
        'Web Scraping': '🕷️',
        'Data Science': '📊',
        'Web Dev': '🌐',
        '.NET': '⚡'
    };
    return icons[filter] || '';
}

// Optional dynamic features are intentionally not auto-enabled.

function initSkillsAnimation() {
    const skillsData = {
        'C#.NET': 90,
        'Angular': 85,
        'Python': 80,
        'Machine Learning': 75,
        'JavaScript': 85,
        'Data Science': 70
    };
    
    const skillsContainer = document.querySelector('.skills-grid');
    
    // Create animated skill bars
    Object.entries(skillsData).forEach(([skill, level]) => {
        const skillBar = document.createElement('div');
        skillBar.className = 'skill-bar';
        skillBar.innerHTML = `
            <div class="skill-info">
                <span class="skill-name">${skill}</span>
                <span class="skill-percentage">${level}%</span>
            </div>
            <div class="skill-progress">
                <div class="skill-fill" data-level="${level}"></div>
            </div>
        `;
        
        // Animate when in view
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const fill = entry.target.querySelector('.skill-fill');
                    setTimeout(() => {
                        fill.style.width = `${level}%`;
                    }, 200);
                }
            });
        });
        
        observer.observe(skillBar);
        skillsContainer.appendChild(skillBar);
    });
}


async function loadBlogPosts() {
    // You can use RSS feeds, Medium API, or any blog platform API
    try {
        // Example with a mock API - replace with your actual blog source
        const blogPosts = [
            {
                title: "Getting Started with Machine Learning",
                excerpt: "A beginner's guide to ML concepts and implementation",
                date: "2024-01-15",
                readTime: "5 min read",
                url: "#"
            },
            {
                title: "Building Scalable Web APIs with .NET Core",
                excerpt: "Best practices for enterprise-level API development",
                date: "2024-01-10",
                readTime: "8 min read",
                url: "#"
            }
        ];
        
        const blogGrid = document.querySelector('.blog-grid');
        blogGrid.innerHTML = '';
        
        blogPosts.forEach(post => {
            const blogCard = createBlogCard(post);
            blogGrid.appendChild(blogCard);
        });
    } catch (error) {
        console.error('Error loading blog posts:', error);
    }
}

function createBlogCard(post) {
    const card = document.createElement('article');
    card.className = 'blog-card fade-in';
    
    card.innerHTML = `
        <div class="blog-content">
            <div class="blog-meta">
                <span class="blog-date">${new Date(post.date).toLocaleDateString()}</span>
                <span class="blog-read-time">${post.readTime}</span>
            </div>
            <h3 class="blog-title">${post.title}</h3>
            <p class="blog-excerpt">${post.excerpt}</p>
            <a href="${post.url}" class="blog-link">Read More →</a>
        </div>
    `;
    
    return card;
}

function enhanceContactForm() {
    const form = document.getElementById('contact-form');
    const inputs = form.querySelectorAll('input, textarea');
    
    inputs.forEach(input => {
        // Real-time validation
        input.addEventListener('input', function() {
            validateField(this);
        });
        
        // Floating labels effect
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            if (!this.value) {
                this.parentElement.classList.remove('focused');
            }
        });
    });
}

function validateField(field) {
    const value = field.value.trim();
    const fieldContainer = field.parentElement;
    
    // Remove existing validation classes
    fieldContainer.classList.remove('valid', 'invalid');
    
    if (field.type === 'email') {
        if (isValidEmail(value)) {
            fieldContainer.classList.add('valid');
        } else if (value) {
            fieldContainer.classList.add('invalid');
        }
    } else if (field.required) {
        if (value) {
            fieldContainer.classList.add('valid');
        } else {
            fieldContainer.classList.add('invalid');
        }
    }
}

function initCardInteraction() {
    const cards = document.querySelectorAll('.project-card, .blog-card, .skill-category');
    if (window.innerWidth < 769) {
        return;
    }
    cards.forEach(card => {
        card.addEventListener('mousemove', function(event) {
            const rect = card.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const rotateX = ((y / rect.height) - 0.5) * -4;
            const rotateY = ((x / rect.width) - 0.5) * 4;
            card.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });
        card.addEventListener('mouseleave', function() {
            card.style.transform = '';
        });
    });
}
