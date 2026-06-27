// Configuration Supabase.
const SUPABASE_URL = 'https://sootfuydjmfwvssjtkni.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0Y9sd23upHv4CY3KmO9Nag_rwPXI2iA';

// Création du client Supabase utilisé par le site.
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// Configuration PAYEMENT PRO.
const PAYMENT_PRO_MERCHANT_ID = 'PP-F6456';

// Produits du magasin
const products = [
    {
        id: 1,
        name: 'Réfrigérateur Samsung',
        price: 450000,
        image: 'refrigerateur.png',
        description: 'Réfrigérateur moderne avec congélateur intégré, économe en énergie. Capacité 450L avec contrôle digital.',
        category: 'refrigeration'
    },
    {
        id: 2,
        name: 'Lave-linge LG',
        price: 380000,
        image: 'lavelinge.png',
        description: 'Machine à laver automatique haute capacité avec technologie AI. 8kg de capacité.',
        category: 'washing'
    },
    {
        id: 3,
        name: 'Four Électrique',
        price: 250000,
        image: 'four-electrique.png',
        description: 'Four multifonction avec convection naturelle et chaleur tournante. 60L.',
        category: 'cooking'
    },
    {
        id: 4,
        name: 'Micro-ondes Panasonic',
        price: 120000,
        image: 'microonde.png',
        description: 'Micro-ondes numérique avec 10 niveaux de puissance. 25L.',
        category: 'cooking'
    },
    {
        id: 5,
        name: 'Climatiseur Daikin',
        price: 600000,
        image: 'climatiseur.png',
        description: 'Climatiseur inverter silencieux avec télécommande intelligente. 12000 BTU.',
        category: 'climate'
    },
    {
        id: 6,
        name: 'Aspirateur Bosch',
        price: 180000,
        image: 'aspirateur.png',
        description: 'Aspirateur sans fil puissant avec filtration HEPA. Très silencieux.',
        category: 'other'
    },
    {
        id: 7,
        name: 'Lave-vaisselle Electrolux',
        price: 320000,
        image: 'lavevaisselle.png',
        description: 'Lave-vaisselle 12 couverts avec 5 programmes de lavage. Classe A++.',
        category: 'washing'
    },
    {
        id: 8,
        name: 'Chauffe-eau électrique',
        price: 95000,
        image: 'chauffe-eau.png',
        description: 'Chauffe-eau électrique 200L pour usage domestique. Résistance renforcée.',
        category: 'other'
    }
];

let databaseProducts = [];

const promoProducts = [
    {
        id: 101,
        name: 'Réfrigérateur Samsung - Offre du mois',
        price: 315000,
        image: 'refrigerateur.png'
    },
    {
        id: 102,
        name: 'Climatiseur Daikin - Offre du mois',
        price: 450000,
        image: 'climatiseur.png'
    },
    {
        id: 103,
        name: 'Lave-linge LG - Offre du mois',
        price: 304000,
        image: 'lavelinge.png'
    }
];

const VALID_CATEGORIES = ['refrigeration', 'washing', 'cooking', 'climate', 'other'];
const STORE_WHATSAPP_NUMBER = '2250141364716';
const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024;

let cart = [];
let currentProduct = null;
let currentQuantity = 1;
let currentSlide = 0;
let filteredCategory = 'all';
let sliderInterval = null;
window.currentOrderStatusFilter = window.currentOrderStatusFilter || 'all';

// Initialiser la page
document.addEventListener('DOMContentLoaded', async function() {
    loadCart();

    if (document.getElementById('productsContainer')) {
        await loadProducts();
    }

    await renderCustomProductsList();

    if (document.getElementById('ordersList') && typeof window.filterOrders === 'function') {
        window.filterOrders();
    }

    await updateAdminStats();

    if (document.querySelector('.hero-slide')) {
        startSlider();
    }

    initializeAOS();
});

// === Utils HTML / Sécurité ===
function escapeHTML(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
function escapeAttribute(value) {
    return escapeHTML(value);
}
function getSafeImageSrc(src) {
    const value = String(src ?? '').trim();
    if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(value)) return value;
    if (/^https:\/\/[^\s"'<>]+$/i.test(value)) return value;
    if (/^[a-zA-Z0-9_\-./]+\.(png|jpg|jpeg|gif|webp)$/i.test(value)) return value;
    return '';
}
function isValidCategory(category) {
    return VALID_CATEGORIES.includes(category);
}

function getCustomProducts() {
    try {
        const saved = localStorage.getItem('customProducts');
        const parsed = JSON.parse(saved || '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(product =>
            product &&
            typeof product.id === 'number' &&
            typeof product.name === 'string' &&
            Number.isFinite(Number(product.price)) &&
            typeof product.image === 'string' &&
            typeof product.description === 'string' &&
            isValidCategory(product.category)
        );
    } catch (error) {
        console.error('Erreur lors du chargement des produits personnalisés:', error);
        return [];
    }
}

function getCatalogProducts() {
    const baseProducts = databaseProducts.length > 0 ? databaseProducts : products;
    return [...baseProducts, ...getCustomProducts()];
}

// === Animations on scroll ===
function initializeAOS() {
    if (!('IntersectionObserver' in window)) return;

    const elements = document.querySelectorAll('[data-aos]');
    if (elements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const animationName = entry.target.dataset.aos || 'fadeInUp';
            const delay = Number(entry.target.dataset.aosDelay) || 0;

            entry.target.style.animationDelay = `${delay}ms`;
            entry.target.style.animation = `${animationName} 0.6s ease forwards`;

            observer.unobserve(entry.target);
        });
    }, { threshold: 0.1 });

    elements.forEach(el => observer.observe(el));
}

// === Slider ===
function startSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length === 0) return;
    if (sliderInterval) clearInterval(sliderInterval);
    sliderInterval = setInterval(() => {
        currentSlide = (currentSlide + 1) % slides.length;
        updateSlider();
    }, 4000);
}
function goToSlide(index) {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length === 0) return;
    currentSlide = Math.max(0, Math.min(Number(index) || 0, slides.length - 1));
    updateSlider();
}
function updateSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.dot');
    if (slides.length === 0) return;
    slides.forEach((slide, index) => {
        slide.classList.toggle('active', index === currentSlide);
    });
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
    });
}

// === Produits ===
async function loadProducts() {
    const productsContainer = document.getElementById('productsContainer');
    if (!productsContainer) return;

    await fetchProductsFromDatabase();

    let catalog = getCatalogProducts();
    if (filteredCategory !== 'all') {
        catalog = catalog.filter(product => product.category === filteredCategory);
    }
    displayProducts(catalog);
}

function displayProducts(productsToDisplay) {
    const container = document.getElementById('productsContainer');
    if (!container) return;

    container.innerHTML = '';

    if (!Array.isArray(productsToDisplay) || productsToDisplay.length === 0) {
        container.innerHTML = '<p class="empty-products">Aucun produit trouvé.</p>';
        return;
    }

    productsToDisplay.forEach((product, index) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.aos = 'fadeUp';
        card.dataset.aosDelay = String(index * 50);

        const safeImage = getSafeImageSrc(product.image);

        card.innerHTML = `
            <img src="${escapeAttribute(safeImage)}" alt="${escapeAttribute(product.name)}" class="product-image">
            <div class="product-info">
                <h3 class="product-title">${escapeHTML(product.name)}</h3>
                <p class="product-description">${escapeHTML(product.description)}</p>
                <div class="product-footer">
                    <span class="product-price">${formatPrice(product.price)}</span>
                    <button class="btn-add" type="button" onclick="openProductModal(${Number(product.id)})">Voir plus</button>
                </div>
            </div>
        `;

        container.appendChild(card);
    });

    initializeAOS();
}

// === Admin Produits Supabase ===
async function addCustomProduct(e) {
    e.preventDefault();

    const imageInput = document.getElementById('adminProductImage');
    const message = document.getElementById('adminMessage');
    if (!imageInput || !message) return;

    const nameInput = document.getElementById('adminProductName');
    const priceInput = document.getElementById('adminProductPrice');
    const categoryInput = document.getElementById('adminProductCategory');
    const descriptionInput = document.getElementById('adminProductDescription');

    if (!nameInput || !priceInput || !categoryInput || !descriptionInput) {
        showAdminMessage(message, 'Formulaire incomplet.', '#e74c3c');
        return;
    }

    const name = nameInput.value.trim();
    const price = Number(priceInput.value);
    const category = categoryInput.value;
    const description = descriptionInput.value.trim();
    const imageFile = imageInput.files[0];

    if (!name || !description || !Number.isFinite(price) || price <= 0 || !isValidCategory(category)) {
        showAdminMessage(message, 'Veuillez remplir correctement tous les champs.', '#e74c3c');
        return;
    }

    if (!imageFile) {
        showAdminMessage(message, 'Veuillez choisir une image.', '#e74c3c');
        return;
    }

    if (!imageFile.type.startsWith('image/')) {
        showAdminMessage(message, 'Le fichier choisi doit être une image.', '#e74c3c');
        return;
    }

    if (imageFile.size > MAX_IMAGE_SIZE) {
        showAdminMessage(message, 'Image trop lourde. Taille maximale: 1.5 Mo.', '#e74c3c');
        return;
    }

    try {
        showAdminMessage(message, 'Vérification admin...', '#555');

        const { data: userData, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !userData.user) {
            console.error('Utilisateur Supabase introuvable:', userError);
            showAdminMessage(message, 'Session admin introuvable. Reconnectez-vous.', '#e74c3c');
            return;
        }

        showAdminMessage(message, 'Upload de l’image...', '#555');

        const fileExt = imageFile.name.split('.').pop().toLowerCase();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `products/${fileName}`;

        const { error: uploadError } = await supabaseClient.storage
            .from('product-images')
            .upload(filePath, imageFile, {
                contentType: imageFile.type,
                upsert: false
            });

        if (uploadError) {
            console.error('Erreur upload image Supabase:', JSON.stringify(uploadError, null, 2));
            showAdminMessage(message, 'Erreur upload image. Voir console.', '#e74c3c');
            return;
        }

        const { data: publicUrlData } = supabaseClient.storage
            .from('product-images')
            .getPublicUrl(filePath);

        const imageUrl = publicUrlData.publicUrl;

        showAdminMessage(message, 'Enregistrement du produit...', '#555');

        const { error: insertError } = await supabaseClient
            .from('products')
            .insert({
                name,
                description,
                category,
                price,
                image: imageUrl,
                stock: 1,
                is_promo: false,
                is_active: true
            });

        if (insertError) {
            console.error('Erreur insertion produit Supabase:', JSON.stringify(insertError, null, 2));
            showAdminMessage(message, 'Erreur insertion produit. Voir console.', '#e74c3c');
            return;
        }

        e.target.reset();

        showAdminMessage(message, 'Produit ajouté au catalogue.', '#17823b');

        if (typeof renderCustomProductsList === 'function') {
            await renderCustomProductsList();
        }

        if (document.getElementById('productsContainer')) {
            await loadProducts();
        }

        if (typeof updateAdminStats === 'function') {
            await updateAdminStats();
        }
    } catch (error) {
        console.error('Erreur générale ajout produit Supabase:', error);
        showAdminMessage(message, 'Impossible d’ajouter le produit dans Supabase.', '#e74c3c');
    }
}

function showAdminMessage(element, text, color) {
    element.textContent = text;
    element.style.color = color;
}

async function renderCustomProductsList() {
    const list = document.getElementById('customProductsList');
    if (!list) return;

    list.innerHTML = '<p class="admin-product-meta">Chargement des produits...</p>';

    try {
        const { data, error } = await supabaseClient
            .from('products')
            .select('id, name, description, category, price, image, is_active, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            list.innerHTML = '<p class="admin-product-meta">Aucun article enregistré pour le moment.</p>';
            return;
        }

        list.innerHTML = data.map(product => {
            const safeImage = getSafeImageSrc(product.image);

            return `
                <div class="admin-product-item">
                    <img src="${escapeAttribute(safeImage)}" alt="${escapeAttribute(product.name)}">
                    <div>
                        <div class="admin-product-name">${escapeHTML(product.name)}</div>
                        <div class="admin-product-meta">
                            ${formatPrice(product.price)} ·
                            ${escapeHTML(getCategoryLabel(product.category))} ·
                            ${product.is_active ? 'Actif' : 'Masqué'}
                        </div>
                    </div>

                    <div class="admin-product-actions">
                        <button class="btn btn-secondary" type="button" onclick="toggleProductStatus(${Number(product.id)}, ${Boolean(product.is_active)})">
                            ${product.is_active ? 'Masquer' : 'Afficher'}
                        </button>

                        <button class="admin-delete-btn" type="button" onclick="deleteCustomProduct(${Number(product.id)})">
                            Supprimer
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Erreur chargement produits Supabase admin:', error);
        list.innerHTML = '<p class="admin-product-meta">Impossible de charger les produits.</p>';
    }
}

async function deleteCustomProduct(productId) {
    const confirmDelete = confirm('Voulez-vous vraiment supprimer ce produit ?');
    if (!confirmDelete) return;

    try {
        const id = Number(productId);

        const { error } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;

        cart = cart.filter(item => Number(item.id) !== id);
        saveCart();

        showNotification('Produit supprimé.', 'info');

        if (typeof renderCustomProductsList === 'function') {
            await renderCustomProductsList();
        }

        if (document.getElementById('productsContainer')) {
            await loadProducts();
        }

        updateCartUI();

        if (typeof updateAdminStats === 'function') {
            await updateAdminStats();
        }
    } catch (error) {
        console.error('Erreur suppression produit Supabase:', error);
        showNotification('❌ Impossible de supprimer le produit.', 'error');
    }
}

function getCategoryLabel(category) {
    const labels = {
        refrigeration: 'Réfrigération',
        washing: 'Lavage',
        cooking: 'Cuisson',
        climate: 'Climatisation',
        other: 'Autre'
    };
    return labels[category] || 'Autre';
}

// === Filtrer les produits ===
function filterProducts(category, clickedButton = null) {
    filteredCategory = category;

    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    if (clickedButton) {
        clickedButton.classList.add('active');
    } else {
        const activeButton = document.querySelector(`[data-category="${category}"]`);
        if (activeButton) activeButton.classList.add('active');
    }

    let filtered = getCatalogProducts();
    if (category !== 'all') {
        filtered = filtered.filter(product => product.category === category);
    }

    displayProducts(filtered);
}

// === Modal produit ===
function openProductModal(productId) {
    const id = Number(productId);
    currentProduct = getCatalogProducts().find(product => product.id === id);
    currentQuantity = 1;

    if (!currentProduct) return;

    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const modalPrice = document.getElementById('modalPrice');
    const quantityInput = document.getElementById('quantityInput');
    const productModal = document.getElementById('productModal');
    const modalOverlay = document.getElementById('modalOverlay');

    if (!modalImage || !modalTitle || !modalDescription || !modalPrice || !quantityInput || !productModal || !modalOverlay) return;

    modalImage.src = getSafeImageSrc(currentProduct.image);
    modalImage.alt = currentProduct.name;
    modalTitle.textContent = currentProduct.name;
    modalDescription.textContent = currentProduct.description;
    modalPrice.textContent = formatPrice(currentProduct.price);
    quantityInput.value = '1';

    productModal.classList.add('open');
    modalOverlay.classList.add('open');
}

function closeModal() {
    const productModal = document.getElementById('productModal');
    const modalOverlay = document.getElementById('modalOverlay');
    if (productModal) productModal.classList.remove('open');
    if (modalOverlay) modalOverlay.classList.remove('open');
    currentProduct = null;
    currentQuantity = 1;
}

function increaseQuantity() {
    currentQuantity++;
    const quantityInput = document.getElementById('quantityInput');
    if (quantityInput) quantityInput.value = String(currentQuantity);
}

function decreaseQuantity() {
    if (currentQuantity <= 1) return;
    currentQuantity--;
    const quantityInput = document.getElementById('quantityInput');
    if (quantityInput) quantityInput.value = String(currentQuantity);
}

function addToCartFromModal() {
    if (!currentProduct) return;

    const quantityInput = document.getElementById('quantityInput');
    const inputQuantity = quantityInput ? Number(quantityInput.value) : currentQuantity;
    const quantity = Math.max(1, Math.floor(inputQuantity || 1));

    addToCart(currentProduct.id, quantity);
    closeModal();
    showNotification('✓ Produit ajouté au panier!');
}

// === Panier ===
function addToCart(productId, quantity = 1) {
    const id = Number(productId);
    const cleanQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    const product = getCatalogProducts().find(item => item.id === id);

    if (!product) {
        showNotification('❌ Produit introuvable.', 'error');
        return;
    }

    addProductToCart(product, cleanQuantity);
}

function addPromoToCart(promoId) {
    const id = Number(promoId);
    const product = promoProducts.find(item => item.id === id);

    if (!product) {
        showNotification('❌ Offre introuvable.', 'error');
        return;
    }

    addProductToCart(product, 1);
    showNotification('✓ Offre ajoutée au panier !');
}

function addProductToCart(product, quantity = 1) {
    const cleanQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
        existingItem.quantity += cleanQuantity;
    } else {
        cart.push({
            id: Number(product.id),
            name: product.name,
            price: Number(product.price),
            image: product.image,
            quantity: cleanQuantity
        });
    }

    saveCart();
    updateCartUI();
}

function removeFromCart(productId) {
    const id
