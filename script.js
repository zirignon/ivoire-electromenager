// Configuration Supabase.
// Remplace les deux valeurs par celles de ton projet Supabase.
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
// Numéro WhatsApp de la boutique.
// Remplace par ton vrai numéro au format international, sans +, sans espace.
const STORE_WHATSAPP_NUMBER = '2250141364716';
const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024; // 1.5 Mo pour éviter de saturer localStorage

let cart = [];
let currentProduct = null;
let currentQuantity = 1;
let currentSlide = 0;
let filteredCategory = 'all';
let sliderInterval = null;
window.currentOrderStatusFilter = window.currentOrderStatusFilter || 'all';

// Initialiser la page
document.addEventListener('DOMContentLoaded', async function() {
    // Charger le panier sur toutes les pages pour éviter d'écraser un panier existant.
    loadCart();

    // Charger le catalogue si la page contient la grille produits.
    if (document.getElementById('productsContainer')) {
      await loadProducts();
    }

    // Afficher les produits personnalisés si la zone admin existe.
    await renderCustomProductsList();

    // Afficher les commandes automatiquement si la page admin contient la liste.
    if (document.getElementById('ordersList') && typeof window.filterOrders === 'function') {
        window.filterOrders();
    }

    // Mettre à jour les statistiques admin si les éléments existent.
    await updateAdminStats();

    // Lancer le slider seulement si la page contient des slides.
    if (document.querySelector('.hero-slide')) {
        startSlider();
    }

    // Initialiser les animations.
    initializeAOS();
});

// Échapper les textes injectés dans innerHTML pour limiter les risques XSS.
function escapeHTML(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

// Échapper les attributs HTML.
function escapeAttribute(value) {
    return escapeHTML(value);
}

// Sécuriser les sources d'image utilisées dans innerHTML.
function getSafeImageSrc(src) {
    const value = String(src ?? '').trim();

    // Images base64 autorisées seulement si elles sont de type image courant.
    if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(value)) {
        return value;
    }

    // URLs HTTPS autorisées, utile pour Supabase Storage.
    if (/^https:\/\/[^\s"'<>]+$/i.test(value)) {
        return value;
    }

    // Fichiers locaux simples autorisés.
    if (/^[a-zA-Z0-9_\-./]+\.(png|jpg|jpeg|gif|webp)$/i.test(value)) {
        return value;
    }

    // Image de secours si la valeur est suspecte.
    return '';
}

function isValidCategory(category) {
    return VALID_CATEGORIES.includes(category);
}

function getCustomProducts() {
    try {
        const saved = localStorage.getItem('customProducts');
        const parsed = JSON.parse(saved || '[]');

        if (!Array.isArray(parsed)) {
            return [];
        }

        // On garde seulement les produits avec une structure correcte.
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
    // Si Supabase a chargé des produits, on les utilise.
    // Sinon, on garde les produits locaux comme secours.
    const baseProducts = databaseProducts.length > 0 ? databaseProducts : products;

    return [...baseProducts, ...getCustomProducts()];
}

// Animations on scroll
function initializeAOS() {
    if (!('IntersectionObserver' in window)) {
        return;
    }

    const elements = document.querySelectorAll('[data-aos]');

    if (elements.length === 0) {
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) {
                return;
            }

            const animationName = entry.target.dataset.aos || 'fadeInUp';
            const delay = Number(entry.target.dataset.aosDelay) || 0;

            entry.target.style.animationDelay = `${delay}ms`;
            entry.target.style.animation = `${animationName} 0.6s ease forwards`;

            observer.unobserve(entry.target);
        });
    }, { threshold: 0.1 });

    elements.forEach(el => observer.observe(el));
}

// Slider automatique
function startSlider() {
    const slides = document.querySelectorAll('.hero-slide');

    if (slides.length === 0) {
        return;
    }

    // Éviter de lancer plusieurs intervalles.
    if (sliderInterval) {
        clearInterval(sliderInterval);
    }

    sliderInterval = setInterval(() => {
        currentSlide = (currentSlide + 1) % slides.length;
        updateSlider();
    }, 4000);
}

function goToSlide(index) {
    const slides = document.querySelectorAll('.hero-slide');

    if (slides.length === 0) {
        return;
    }

    currentSlide = Math.max(0, Math.min(Number(index) || 0, slides.length - 1));
    updateSlider();
}

function updateSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.dot');

    if (slides.length === 0) {
        return;
    }

    slides.forEach((slide, index) => {
        slide.classList.toggle('active', index === currentSlide);
    });

    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
    });
}

// Charger les produits
async function loadProducts() {
    const productsContainer = document.getElementById('productsContainer');

    if (!productsContainer) {
        return;
    }

    // Charge les produits depuis Supabase.
    await fetchProductsFromDatabase();

    // Met à jour la section "Offres du Mois" avec les produits is_promo=true
    renderPromoSection();

    let catalog = getCatalogProducts();

    if (filteredCategory !== 'all') {
        catalog = catalog.filter(product => product.category === filteredCategory);
    }

    displayProducts(catalog);
}


function displayProducts(productsToDisplay) {
    const container = document.getElementById('productsContainer');

    if (!container) {
        return;
    }

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

        // Affichage du prix : prix barré si old_price est défini, badge promo si is_promo est actif
        const priceHTML = product.oldPrice
            ? `<span class="product-price">${formatPrice(product.price)}</span>
               <span class="product-old-price">${formatPrice(product.oldPrice)}</span>`
            : `<span class="product-price">${formatPrice(product.price)}</span>`;

        const promoBadge = product.isPromo
            ? `<span class="product-promo-badge">Promo</span>`
            : '';

        card.innerHTML = `
            <img src="${escapeAttribute(safeImage)}" alt="${escapeAttribute(product.name)}" class="product-image">
            ${promoBadge}
            <div class="product-info">
                <h3 class="product-title">${escapeHTML(product.name)}</h3>
                <p class="product-description">${escapeHTML(product.description)}</p>
                <div class="product-footer">
                    <div class="product-prices">${priceHTML}</div>
                    <button class="btn-add" type="button" onclick="openProductModal(${Number(product.id)})">Voir plus</button>
                </div>
            </div>
        `;

        container.appendChild(card);
    });

    initializeAOS();
}

async function addCustomProduct(e) {
    e.preventDefault();

    const imageInput = document.getElementById('adminProductImage');
    const message = document.getElementById('adminMessage');

    if (!imageInput || !message) {
        return;
    }

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

        // Vérifier que l'utilisateur est connecté.
        const { data: userData, error: userError } = await supabaseClient.auth.getUser();

        if (userError || !userData.user) {
            console.error('Utilisateur Supabase introuvable:', userError);
            showAdminMessage(message, 'Session admin introuvable. Reconnectez-vous.', '#e74c3c');
            return;
        }


        showAdminMessage(message, 'Upload de l’image...', '#555');

        // Créer un nom de fichier unique.
        const fileExt = imageFile.name.split('.').pop().toLowerCase();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `products/${fileName}`;

        // 1. Upload image.
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
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

        // 2. URL publique.
        const { data: publicUrlData } = supabaseClient.storage
            .from('product-images')
            .getPublicUrl(filePath);

        const imageUrl = publicUrlData.publicUrl;

        showAdminMessage(message, 'Enregistrement du produit...', '#555');

        // 3. Insertion produit.
        const { data: insertedProduct, error: insertError } = await supabaseClient
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
            })
            .select('id, name')
            .single();

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

    if (!list) {
        return;
    }

    list.innerHTML = '<p class="admin-product-meta">Chargement des produits...</p>';

    try {
        const { data, error } = await supabaseClient
            .from('products')
            .select('id, name, description, category, price, old_price, stock, image, is_active, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

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
                        <button class="btn btn-primary" type="button" onclick="openEditProductModal(${Number(product.id)})">
                            Modifier
                        </button>
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

function updateAdminStats() {
    const productsCountElement = document.getElementById('adminProductsCount');
    const ordersCountElement = document.getElementById('adminOrdersCount');

    if (!productsCountElement && !ordersCountElement) {
        return;
    }

    const customProductsCount = getCustomProducts().length;
    const ordersCount = getSavedOrders().length;

    if (productsCountElement) {
        productsCountElement.textContent = String(customProductsCount);
    }

    if (ordersCountElement) {
        ordersCountElement.textContent = String(ordersCount);
    }
}

async function deleteCustomProduct(productId) {
    const confirmDelete = confirm('Voulez-vous vraiment supprimer ce produit ?');

    if (!confirmDelete) {
        return;
    }

    try {
        const id = Number(productId);

        const { error } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', id);

        if (error) {
            throw error;
        }

        // Supprimer aussi du panier si le produit supprimé y était.
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

// ─── Modification d'un produit existant ───────────────────────────────────────

async function openEditProductModal(productId) {
    // Récupère les données à jour du produit depuis Supabase
    const { data: product, error } = await supabaseClient
        .from('products')
        .select('id, name, description, category, price, old_price, stock, is_promo, is_active')
        .eq('id', productId)
        .single();

    if (error || !product) {
        showNotification('❌ Impossible de charger le produit.', 'error');
        return;
    }

    // Pré-remplit les champs du modal
    document.getElementById('editProductId').value      = product.id;
    document.getElementById('editProductName').value    = product.name ?? '';
    document.getElementById('editProductDesc').value    = product.description ?? '';
    document.getElementById('editProductCat').value     = product.category ?? 'other';
    document.getElementById('editProductPrice').value   = product.price ?? '';
    document.getElementById('editProductOldPrice').value = product.old_price ?? '';
    document.getElementById('editProductStock').value   = product.stock ?? 0;
    document.getElementById('editProductPromo').checked = Boolean(product.is_promo);
    document.getElementById('editProductActive').checked = Boolean(product.is_active);

    // Affiche le modal
    const modal = document.getElementById('editProductModal');
    if (modal) modal.style.display = 'flex';
}

function closeEditProductModal() {
    const modal = document.getElementById('editProductModal');
    if (modal) modal.style.display = 'none';
}

async function saveProductEdits() {
    const id          = Number(document.getElementById('editProductId').value);
    const name        = document.getElementById('editProductName').value.trim();
    const description = document.getElementById('editProductDesc').value.trim();
    const category    = document.getElementById('editProductCat').value;
    const price       = parseFloat(document.getElementById('editProductPrice').value);
    const oldPriceRaw = document.getElementById('editProductOldPrice').value.trim();
    const old_price   = oldPriceRaw !== '' ? parseFloat(oldPriceRaw) : null;
    const stock       = parseInt(document.getElementById('editProductStock').value, 10);
    const is_promo    = document.getElementById('editProductPromo').checked;
    const is_active   = document.getElementById('editProductActive').checked;

    // Validations basiques
    if (!name) {
        showNotification('❌ Le nom du produit est obligatoire.', 'error');
        return;
    }
    if (!Number.isFinite(price) || price <= 0) {
        showNotification('❌ Le prix doit être un nombre positif.', 'error');
        return;
    }
    if (old_price !== null && (!Number.isFinite(old_price) || old_price <= 0)) {
        showNotification('❌ Le prix barré doit être un nombre positif (ou vide).', 'error');
        return;
    }
    if (!isValidCategory(category)) {
        showNotification('❌ Catégorie invalide.', 'error');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('products')
            .update({ name, description, category, price, old_price, stock, is_promo, is_active })
            .eq('id', id);

        if (error) throw error;

        showNotification('✅ Produit mis à jour.', 'success');
        closeEditProductModal();

        // Rafraîchit la liste admin et la vitrine
        if (typeof renderCustomProductsList === 'function') {
            await renderCustomProductsList();
        }
        if (document.getElementById('productsContainer')) {
            await loadProducts();
        }
    } catch (err) {
        console.error('Erreur mise à jour produit:', err);
        showNotification('❌ Impossible de mettre à jour le produit.', 'error');
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

// Filtrer les produits
function filterProducts(category, clickedButton = null) {
    filteredCategory = category;

    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    if (clickedButton) {
        clickedButton.classList.add('active');
    } else {
        const activeButton = document.querySelector(`[data-category="${category}"]`);

        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    let filtered = getCatalogProducts();

    if (category !== 'all') {
        filtered = filtered.filter(product => product.category === category);
    }

    displayProducts(filtered);
}

// Ouvrir modal produit
function openProductModal(productId) {
    const id = Number(productId);
    currentProduct = getCatalogProducts().find(product => product.id === id);
    currentQuantity = 1;

    if (!currentProduct) {
        return;
    }

    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const modalPrice = document.getElementById('modalPrice');
    const quantityInput = document.getElementById('quantityInput');
    const productModal = document.getElementById('productModal');
    const modalOverlay = document.getElementById('modalOverlay');

    if (!modalImage || !modalTitle || !modalDescription || !modalPrice || !quantityInput || !productModal || !modalOverlay) {
        return;
    }

    modalImage.src = getSafeImageSrc(currentProduct.image);
    modalImage.alt = currentProduct.name;
    modalTitle.textContent = currentProduct.name;
    modalDescription.textContent = currentProduct.description;
    modalPrice.textContent = formatPrice(currentProduct.price);
    quantityInput.value = '1';

    productModal.classList.add('open');
    modalOverlay.classList.add('open');
}

// Fermer modal produit
function closeModal() {
    const productModal = document.getElementById('productModal');
    const modalOverlay = document.getElementById('modalOverlay');

    if (productModal) {
        productModal.classList.remove('open');
    }

    if (modalOverlay) {
        modalOverlay.classList.remove('open');
    }

    currentProduct = null;
    currentQuantity = 1;
}

// Augmenter quantité
function increaseQuantity() {
    currentQuantity++;

    const quantityInput = document.getElementById('quantityInput');

    if (quantityInput) {
        quantityInput.value = String(currentQuantity);
    }
}

// Diminuer quantité
function decreaseQuantity() {
    if (currentQuantity <= 1) {
        return;
    }

    currentQuantity--;

    const quantityInput = document.getElementById('quantityInput');

    if (quantityInput) {
        quantityInput.value = String(currentQuantity);
    }
}

// Ajouter au panier depuis la modal
function addToCartFromModal() {
    if (!currentProduct) {
        return;
    }

    const quantityInput = document.getElementById('quantityInput');
    const inputQuantity = quantityInput ? Number(quantityInput.value) : currentQuantity;
    const quantity = Math.max(1, Math.floor(inputQuantity || 1));

    addToCart(currentProduct.id, quantity);
    closeModal();
    showNotification('✓ Produit ajouté au panier!');
}

// Ajouter au panier
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

function addPromoToCart(productId) {
    const id = Number(productId);
    // Cherche dans les produits Supabase (databaseProducts) plutôt que dans
    // les anciens promoProducts codés en dur.
    const product = databaseProducts.find(item => item.id === id);

    if (!product) {
        showNotification('❌ Offre introuvable.', 'error');
        return;
    }

    addProductToCart(product, 1);
    showNotification('✓ Offre ajoutée au panier !');
}

// Remplit la section "Offres du Mois" avec les produits marqués is_promo=true dans Supabase.
// Appelée après le chargement des produits depuis la base.
function renderPromoSection() {
    const container = document.getElementById('promoCardsContainer');
    if (!container) return;

    const promos = databaseProducts.filter(p => p.isPromo);

    if (promos.length === 0) {
        // Aucune promo en cours : masque la section proprement
        const section = document.getElementById('promo');
        if (section) section.style.display = 'none';
        return;
    }

    // S'assure que la section est visible (au cas où elle avait été masquée)
    const section = document.getElementById('promo');
    if (section) section.style.display = '';

    container.innerHTML = promos.map((product, index) => {
        const safeImage = getSafeImageSrc(product.image);

        // Calcul du pourcentage de réduction si old_price est défini
        const discountBadge = product.oldPrice && product.oldPrice > product.price
            ? `<div class="promo-badge">-${Math.round((1 - product.price / product.oldPrice) * 100)}%</div>`
            : '';

        const oldPriceHTML = product.oldPrice
            ? `<span class="old-price">${formatPrice(product.oldPrice)}</span> `
            : '';

        return `
            <div class="promo-card" data-aos="zoomIn" data-aos-delay="${index * 100}">
                ${discountBadge}
                <img src="${escapeAttribute(safeImage)}" alt="${escapeAttribute(product.name)}">
                <div class="promo-content">
                    <h3>${escapeHTML(product.name)}</h3>
                    <p class="promo-price">
                        ${oldPriceHTML}<span class="new-price">${formatPrice(product.price)}</span>
                    </p>
                    <button class="btn-add promo-add-btn" type="button" onclick="addPromoToCart(${Number(product.id)})">
                        Ajouter au panier
                    </button>
                </div>
            </div>
        `;
    }).join('');

    initializeAOS();
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

// Retirer du panier
function removeFromCart(productId) {
    const id = Number(productId);

    cart = cart.filter(item => item.id !== id);

    saveCart();
    updateCartUI();
}

// Vider complètement le panier
function clearCart() {
    if (cart.length === 0) {
        showNotification('Votre panier est déjà vide.', 'info');
        return;
    }

    const confirmClear = confirm('Voulez-vous vraiment vider le panier ?');

    if (!confirmClear) {
        return;
    }

    cart = [];
    saveCart();
    updateCartUI();

    showNotification('🗑️ Panier vidé.');
}

// Changer la quantité dans le panier
function updateCartQuantity(productId, change) {
    const id = Number(productId);
    const quantityChange = Number(change);
    const item = cart.find(cartItem => cartItem.id === id);

    if (!item || !Number.isFinite(quantityChange)) {
        return;
    }

    item.quantity += quantityChange;

    if (item.quantity <= 0) {
        removeFromCart(id);
        return;
    }

    saveCart();
    updateCartUI();
}

// Mettre à jour l'interface du panier
function updateCartUI() {
    const cartItemsDiv = document.getElementById('cartItems');
    const cartCountSpan = document.getElementById('cartCount');
    const cartTotalSpan = document.getElementById('cartTotal');

    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (cartCountSpan) {
        cartCountSpan.textContent = String(itemCount);
    }

    // Certaines pages peuvent avoir seulement l'icône panier, sans sidebar complète.
    if (!cartItemsDiv || !cartTotalSpan) {
        return;
    }

    if (cart.length === 0) {
        cartItemsDiv.innerHTML = '<p class="empty-cart">Votre panier est vide</p>';
        cartTotalSpan.textContent = formatPrice(0);
        return;
    }

    cartItemsDiv.innerHTML = cart.map(item => {
        const safeImage = getSafeImageSrc(item.image);

        return `
            <div class="cart-item">
                <img src="${escapeAttribute(safeImage)}" alt="${escapeAttribute(item.name)}" class="cart-item-image">
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHTML(item.name)}</div>
                    <div class="cart-item-unit-price">Prix unitaire: ${formatPrice(item.price)}</div>
                    <div class="cart-item-price">Total: ${formatPrice(item.price * item.quantity)}</div>
                </div>
                <div class="cart-item-qty">
                    <button type="button" onclick="updateCartQuantity(${Number(item.id)}, -1)">−</button>
                    <span>${Number(item.quantity)}</span>
                    <button type="button" onclick="updateCartQuantity(${Number(item.id)}, 1)">+</button>
                    <button class="remove-btn" type="button" onclick="removeFromCart(${Number(item.id)})">✕</button>
                </div>
            </div>
        `;
    }).join('');

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    cartTotalSpan.textContent = formatPrice(total);
}

// Basculer le panier
function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('overlay');

    if (sidebar) {
        sidebar.classList.toggle('open');
    }

    if (overlay) {
        overlay.classList.toggle('open');
    }
}

// Ouvrir formulaire de paiement
function openCheckoutForm() {
    if (cart.length === 0) {
        showNotification('❌ Votre panier est vide!', 'error');
        return;
    }

    const orderSummary = document.getElementById('orderSummary');
    const checkoutTotal = document.getElementById('checkoutTotal');
    const checkoutModal = document.getElementById('checkoutModal');
    const modalOverlay = document.getElementById('modalOverlay');

    if (!orderSummary || !checkoutTotal || !checkoutModal || !modalOverlay) {
        return;
    }

    const summary = cart.map(item => {
        const safeImage = getSafeImageSrc(item.image);

        return `
            <div class="order-item-detailed">
                <img src="${escapeAttribute(safeImage)}" alt="${escapeAttribute(item.name)}" class="order-item-image">
                <div class="order-item-details">
                    <div class="order-item-name">${escapeHTML(item.name)}</div>
                    <div class="order-item-qty">Quantité: <strong>${Number(item.quantity)}</strong></div>
                </div>
                <div class="order-item-calc">
                    <div class="order-item-unit">${formatPrice(item.price)} × ${Number(item.quantity)}</div>
                    <div class="order-item-subtotal">${formatPrice(item.price * item.quantity)}</div>
                </div>
            </div>
        `;
    }).join('');

    orderSummary.innerHTML = summary;

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    checkoutTotal.textContent = formatPrice(total);

    checkoutModal.classList.add('open');
    modalOverlay.classList.add('open');

    // Fermer le panier si ouvert.
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('overlay');

    if (sidebar) {
        sidebar.classList.remove('open');
    }

    if (overlay) {
        overlay.classList.remove('open');
    }
}

// Fermer formulaire de paiement
function closeCheckout() {
    const checkoutModal = document.getElementById('checkoutModal');
    const modalOverlay = document.getElementById('modalOverlay');

    if (checkoutModal) {
        checkoutModal.classList.remove('open');
    }

    if (modalOverlay) {
        modalOverlay.classList.remove('open');
    }
}

// Récupérer les commandes sauvegardées
function getSavedOrders() {
    try {
        const savedOrders = localStorage.getItem('orders');
        const parsedOrders = JSON.parse(savedOrders || '[]');

        return Array.isArray(parsedOrders) ? parsedOrders : [];
    } catch (error) {
        console.error('Erreur chargement commandes:', error);
        return [];
    }
}

// Sauvegarder une nouvelle commande
function saveOrder(order) {
    try {
        const orders = getSavedOrders();

        // Ajouter la nouvelle commande au début de la liste
        orders.unshift(order);

        localStorage.setItem('orders', JSON.stringify(orders));
    } catch (error) {
        console.error('Erreur sauvegarde commande:', error);
    }
}

// Retourner la classe CSS selon le statut de commande
function getOrderStatusClass(status) {
    switch (status) {
        case 'Nouvelle':
            return 'status-new';
        case 'En traitement':
            return 'status-processing';
        case 'Livrée':
            return 'status-delivered';
        case 'Annulée':
            return 'status-cancelled';
        default:
            return 'status-new';
    }
}

// Afficher les commandes dans l'admin
function renderOrdersList(ordersToRender = null) {
    const ordersList = document.getElementById('ordersList');

    if (!ordersList) {
        return;
    }

    const orders = ordersToRender || getSavedOrders();

    if (orders.length === 0) {
        ordersList.innerHTML = '<p class="admin-product-meta">Aucune commande enregistrée pour le moment.</p>';
        return;
    }

    ordersList.innerHTML = orders.map(order => {
        const items = Array.isArray(order.items) ? order.items : [];

        const itemsHTML = items.map(item => `
            <li>
                ${Number(item.quantity)} x ${escapeHTML(item.name)} —
                ${formatPrice(Number(item.price) * Number(item.quantity))}
            </li>
        `).join('');

        const currentStatus = order.status || 'Nouvelle'
        const statusClass = getOrderStatusClass(currentStatus);

        return `
            <div class="admin-order-item">
                <div class="admin-order-header">
                    <strong>Commande #${escapeHTML(order.id)}</strong>
                    <span>${escapeHTML(order.date)}</span>
                </div>

                <div class="admin-order-client">
                    <p><strong>Client :</strong> ${escapeHTML(order.customer?.name || '')}</p>
                    <p><strong>Téléphone :</strong> ${escapeHTML(order.customer?.phone || '')}</p>
                    <p><strong>Email :</strong> ${escapeHTML(order.customer?.email || 'Non fourni')}</p>
                    <p><strong>Adresse :</strong> ${escapeHTML(order.customer?.address || '')}</p>
                    <p><strong>Paiement :</strong> ${escapeHTML(order.payment || '')}</p>
                    <p>
                        <strong>Statut :</strong>
                        <span class="order-status-badge ${statusClass}">
                            ${escapeHTML(currentStatus)}
                        </span>
                    </p>

                </div>

                <ul class="admin-order-products">
                    ${itemsHTML}
                </ul>

                <div class="admin-order-footer">
                    <div class="admin-order-total">
                        Total : ${formatPrice(order.total)}
                    </div>

                    <div class="admin-order-actions">
                        <select class="admin-order-status" onchange="updateOrderStatus(${Number(order.id)}, this.value)">
                            <option value="Nouvelle" ${currentStatus === 'Nouvelle' ? 'selected' : ''}>Nouvelle</option>
                            <option value="En traitement" ${currentStatus === 'En traitement' ? 'selected' : ''}>En traitement</option>
                            <option value="Livrée" ${currentStatus === 'Livrée' ? 'selected' : ''}>Livrée</option>
                            <option value="Annulée" ${currentStatus === 'Annulée' ? 'selected' : ''}>Annulée</option>
                       </select>

                       <button class="btn btn-secondary" type="button" onclick="printOrder(${Number(order.id)})">Imprimer</button>

                       <button class="btn btn-secondary" type="button" onclick="sendOrderWhatsAppToClient(${Number(order.id)})">WhatsApp client</button>

                       <button class="admin-delete-btn" type="button" onclick="deleteOrder(${Number(order.id)})">Supprimer</button>
                    </div>
                 </div>
        </div>
        `;
    }).join('');
}

// Supprimer tout l'historique des commandes
function clearOrders() {
    const confirmDelete = confirm('Voulez-vous vraiment supprimer toutes les commandes enregistrées ?');

    if (!confirmDelete) {
        return;
    }

    localStorage.removeItem('orders');

    if (typeof window.filterOrders === 'function') {
        window.filterOrders();
    }

    if (typeof updateAdminStats === 'function') {
        updateAdminStats();
    }

    showNotification('Historique des commandes supprimé.', 'info');
}

// Compatibilité si ton HTML appelle clearOrder() au lieu de clearOrders()
function clearOrder() {
    clearOrders();
}

// Supprimer une seule commande
function deleteOrder(orderId) {
    const confirmDelete = confirm('Voulez-vous supprimer cette commande ?');

    if (!confirmDelete) {
        return;
    }

    const id = Number(orderId);
    const orders = getSavedOrders().filter(order => Number(order.id) !== id);

    localStorage.setItem('orders', JSON.stringify(orders));

    if (typeof window.filterOrders === 'function') {
        window.filterOrders();
    }

    if (typeof updateAdminStats === 'function') {
        updateAdminStats();
    }

    showNotification('Commande supprimée.', 'info');
}

// Mettre à jour le statut d'une commande
function updateOrderStatus(orderId, status) {
    const id = Number(orderId);
    const orders = getSavedOrders();

    const order = orders.find(item => Number(item.id) === id);

    if (!order) {
      showNotification('Commande introuvable.', 'error');

        return;
    }

    order.status = status;

    localStorage.setItem('orders', JSON.stringify(orders));

    if (typeof window.filterOrders === 'function') {
        window.filterOrders();
    }

    if (typeof updateAdminStats === 'function') {
        updateAdminStats();
    }

    showNotification('Statut de la commande mis à jour.');
}

async function saveOrderToDatabase(orderData) {
    // On utilise l'identifiant déjà généré côté JavaScript.
    // Comme la colonne id est GENERATED BY DEFAULT, Supabase accepte un id fourni.
    const orderId = Number(orderData.id);

    // 1. Enregistrer la commande principale dans Supabase.
    const { error: orderError } = await supabaseClient
      .from('orders')
      .insert({
          id: orderId,
          customer_name: orderData.customer.name,
          customer_phone: orderData.customer.phone,
          customer_email: orderData.customer.email || null,
          customer_address: orderData.customer.address,
          payment_method: orderData.paymentMethod,
          payment_label: orderData.payment,
          total: Number(orderData.total),
          status: orderData.status,

        // Informations paiement.
        payment_status: orderData.paymentMethod === 'livraison'
            ? 'cash_on_delivery'
            : 'pending',

        payment_provider: orderData.paymentMethod === 'livraison'
            ? 'cash'
            : 'paiement_pro',

        payment_reference: `CMD-${orderData.id}`
    });

    if (orderError) {
        console.error('Erreur insertion orders:', JSON.stringify(orderError, null, 2));
        throw orderError;
    }

    // 2. Préparer les articles de la commande.
    const orderItems = orderData.items.map(item => {
        const itemId = Number(item.id);

        // On met product_id seulement si le produit existe dans les produits Supabase chargés.
        const productExistsInDatabase = databaseProducts.some(product => Number(product.id) === itemId);

        return {
            order_id: orderId,
            product_id: productExistsInDatabase ? itemId : null,
            product_name: item.name,
            quantity: Number(item.quantity),
            unit_price: Number(item.price),
            subtotal: Number(item.price) * Number(item.quantity)
        };
    });

    // 3. Enregistrer les articles.
    const { error: itemsError } = await supabaseClient
        .from('order_items')
        .insert(orderItems);

    if (itemsError) {
        console.error('Erreur insertion order_items:', JSON.stringify(itemsError, null, 2));
        throw itemsError;
    }

    return {
        id: orderId
    };
}

function splitCustomerName(fullName) {
    // Sépare le nom complet du client en prénom et nom.
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
        return {
            firstName: 'Client',
            lastName: 'Ivoire Électroménager'
        };
    }

    if (parts.length === 1) {
        return {
            firstName: parts[0],
            lastName: 'Client'
        };
    }

    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' ')
    };
}

function getPaiementProChannel(paymentMethod) {
    // Codes PAYEMENT PRO autorisés pour la Côte d'Ivoire + carte bancaire.
    const allowedChannels = ['OMCIV2', 'MOMOCI', 'FLOOZ', 'WAVECI', 'CARD'];

    if (allowedChannels.includes(paymentMethod)) {
        return paymentMethod;
    }

    return '';
}

async function startPaiementProPayment(order) {
    try {
        if (typeof PaiementPro === 'undefined') {
            showNotification('❌ PAYEMENT PRO n’est pas chargé.', 'error');
            console.error('SDK PAYEMENT PRO introuvable.');
            return;
        }

        const customer = order.customer || {};
        const nameParts = splitCustomerName(customer.name);

        const paymentReference = `CMD-${order.id}`;
        const channel = getPaiementProChannel(order.paymentMethod);

        if (!channel) {
            showNotification('❌ Moyen de paiement en ligne invalide.', 'error');
            return;
        }

        if (!customer.email) {
            showNotification('❌ L’email est obligatoire pour le paiement en ligne.', 'error');
            return;
        }

        if (!customer.phone) {
            showNotification('❌ Le téléphone est obligatoire pour le paiement en ligne.', 'error');
            return;
        }

        showNotification('Initialisation du paiement...', 'info');

        // Création de l’instance PAYEMENT PRO.
        const paiementPro = new PaiementPro(PAYMENT_PRO_MERCHANT_ID);

        // Montant à payer.
        paiementPro.amount = Number(order.total);

        // Mode de paiement : CARD ou Mobile Money selon provider.
        paiementPro.channel = channel;

        // Référence unique de transaction.
        paiementPro.referenceNumber = paymentReference;

        // Informations client.
        paiementPro.customerEmail = customer.email;
        paiementPro.customerFirstName = nameParts.firstName;
        paiementPro.customerLastname = nameParts.lastName;
        paiementPro.customerPhoneNumber = customer.phone;

        // Description du paiement.
        paiementPro.description = `Commande #${order.id} - Ivoire Électroménager`;

        // Devise FCFA.
        paiementPro.countryCurrencyCode = '952';

        // URL de retour après paiement.
        paiementPro.returnURL = 'https://zirignon.github.io/ivoire-electromenager/';

        // Contexte retourné par PAYEMENT PRO.
        paiementPro.returnContext = JSON.stringify({
            order_id: order.id,
            reference: paymentReference,
            source: 'ivoire-electromenager'
        });

        // URL de la Supabase Edge Function qui reçoit la confirmation
        // serveur-à-serveur de PAYEMENT PRO (GitHub Pages ne peut pas
        // recevoir ce type de notification directement).
        paiementPro.notificationURL = 'https://sootfuydjmfwvssjtkni.supabase.co/functions/v1/paiement-webhook';

        // Initialiser le paiement et récupérer l’URL.
        await paiementPro.getUrlPayment();

        if (paiementPro.success && paiementPro.url) {
            showNotification('Redirection vers PAYEMENT PRO...', 'success');

            // Redirection vers la page de paiement PAYEMENT PRO.
            window.location.href = paiementPro.url;
            return;
        }

        console.error('Erreur PAYEMENT PRO:', paiementPro);
        showNotification('❌ Impossible d’initialiser le paiement.', 'error');

    } catch (error) {
        console.error('Erreur paiement PAYEMENT PRO:', error);
        showNotification('❌ Erreur lors du lancement du paiement.', 'error');
    }
}

// Traiter la commande et l'envoyer sur WhatsApp ou PAYEMENT PRO.
async function processCheckout(e) {
    e.preventDefault();

    if (cart.length === 0) {
        showNotification('❌ Votre panier est vide!', 'error');
        return;
    }

    const form = e.target;

    const nomInput = form.querySelector('input[type="text"]');
    const telephoneInput = form.querySelector('input[type="tel"]');
    const adresseInput = form.querySelector('textarea');
    const emailInput = form.querySelector('input[type="email"]');
    const paiementInput = form.querySelector('select');

    if (!nomInput || !telephoneInput || !adresseInput || !paiementInput) {
        showNotification('❌ Formulaire incomplet.', 'error');
        return;
    }

    const nom = nomInput.value.trim();
    const telephone = telephoneInput.value.trim();
    const cleanedPhone = telephone.replace(/\D/g, '');
    const adresse = adresseInput.value.trim();
    const email = emailInput ? emailInput.value.trim() : '';
    const paiement = paiementInput.value;

    const onlinePaymentMethods = ['OMCIV2', 'MOMOCI', 'FLOOZ', 'WAVECI', 'CARD'];
    const isOnlinePayment = onlinePaymentMethods.includes(paiement);

    if (cleanedPhone.length < 8) {
        showNotification('❌ Numéro de téléphone invalide.', 'error');
        return;
    }

    if (!nom || !telephone || !adresse || !paiement) {
        showNotification('❌ Veuillez remplir les champs obligatoires.', 'error');
        return;
    }

    if (isOnlinePayment && !email) {
        showNotification('❌ L’email est obligatoire pour le paiement en ligne.', 'error');
        return;
    }

    // Calculer le total de la commande.
    const total = cart.reduce((sum, item) => {
        return sum + Number(item.price) * Number(item.quantity);
    }, 0);

    // Générer un identifiant local temporaire.
    let orderId = Date.now();
    const orderDate = new Date().toLocaleString('fr-FR');

    // Convertir la valeur du moyen de paiement en texte lisible.
    const paymentLabels = {
        livraison: 'Paiement à la livraison',
        OMCIV2: 'Orange Money CI',
        MOMOCI: 'MTN Mobile Money CI',
        FLOOZ: 'Moov Money CI',
        WAVECI: 'Wave CI',
        CARD: 'Visa / Mastercard'
    };

    const paiementLabel = paymentLabels[paiement] || 'Non précisé';

    // Préparer la commande.
    const order = {
        id: orderId,
        date: orderDate,
        customer: {
            name: nom,
            phone: telephone,
            email: email,
            address: adresse
        },
        items: cart.map(item => ({
            id: Number(item.id),
            name: item.name,
            price: Number(item.price),
            quantity: Number(item.quantity),
            image: item.image || ''
        })),
        total: total,
        paymentMethod: paiement,
        payment: paiementLabel,
        status: 'Nouvelle'
    };

    try {
        // Enregistrer la commande dans Supabase.
        const savedOrder = await saveOrderToDatabase(order);

        // Utiliser l'identifiant réel ou local.
        orderId = savedOrder.id;
        order.id = savedOrder.id;

        // Garder aussi une copie locale pour compatibilité.
        saveOrder(order);
    } catch (error) {
        console.error('Erreur sauvegarde commande Supabase complète:', JSON.stringify(error, null, 2));
        showNotification('❌ Impossible d’enregistrer la commande dans la base.', 'error');
        return;
    }

    // Si paiement en ligne, lancer PAYEMENT PRO.
    if (isOnlinePayment) {
        await startPaiementProPayment(order);
        return;
    }

    // Sinon, paiement à la livraison : continuer avec WhatsApp.
    const items = cart.map((item, index) => {
        const lineTotal = Number(item.price) * Number(item.quantity);

        return `${index + 1}. ${item.name}
   Quantité : ${item.quantity}
   Prix unitaire : ${formatPrice(item.price)}
   Sous-total : ${formatPrice(lineTotal)}`;
    }).join('\n\n');

    const whatsappMessage = `
Bonjour, je souhaite passer une commande chez Ivoire Électroménagers.

📋 COMMANDE #${orderId}
━━━━━━━━━━━━━━━━━━━━

📅 Date : ${orderDate}
📦 Statut : Nouvelle

👤 INFORMATIONS CLIENT
Nom : ${nom}
Téléphone : ${telephone}
Email : ${email || 'Non fourni'}
Adresse : ${adresse}

🛒 ARTICLES COMMANDÉS
${items}

💰 TOTAL À PAYER : ${formatPrice(total)}
💳 Moyen de paiement : ${paiementLabel}

🚚 Livraison : Votre commande sera livrée sous 24H.

Merci.
`.trim();

    const encodedMessage = encodeURIComponent(whatsappMessage);
    const whatsappUrl = `https://wa.me/${STORE_WHATSAPP_NUMBER}?text=${encodedMessage}`;

    if (typeof updateAdminStats === 'function') {
        updateAdminStats();
    }

    window.open(whatsappUrl, '_blank');

    cart = [];
    saveCart();
    updateCartUI();
    closeCheckout();
    form.reset();

    showNotification('✅ Commande enregistrée et envoyée vers WhatsApp.');
}

// Ancienne fonction conservée pour compatibilité
function checkout() {
    openCheckoutForm();
}

// Newsletter
async function subscribeNewsletter(e) {
    e.preventDefault();

    const emailInput = e.target.querySelector('input[type="email"]');

    if (!emailInput || !emailInput.value.trim()) {
        showNotification('❌ Veuillez saisir votre email.', 'error');
        return;
    }

    const email = emailInput.value.trim().toLowerCase();

    try {
        // Enregistrer l'email dans Supabase.
        const { error } = await supabaseClient
            .from('newsletter_subscribers')
            .insert({ email });

        if (error) {
            // Code PostgreSQL pour doublon unique.
            if (error.code === '23505') {
                showNotification('Cet email est déjà inscrit.', 'info');
                return;
            }

            console.error('Erreur newsletter Supabase:', JSON.stringify(error, null, 2));
            showNotification('❌ Impossible d’enregistrer votre email.', 'error');
            return;
        }

        showNotification(`✓ Merci ! Votre email ${email} a été enregistré.`);
        e.target.reset();
    } catch (error) {
        console.error('Erreur newsletter:', error);
        showNotification('❌ Erreur de connexion à la newsletter.', 'error');
    }
}

// Sauvegarder le panier dans localStorage
function saveCart() {
    try {
        localStorage.setItem('cart', JSON.stringify(cart));
    } catch (error) {
        console.error('Erreur sauvegarde panier:', error);
        showNotification('❌ Impossible de sauvegarder le panier.', 'error');
    }
}

// Charger le panier depuis localStorage
function loadCart() {
    try {
        const saved = localStorage.getItem('cart');
        const parsed = JSON.parse(saved || '[]');

        if (!Array.isArray(parsed)) {
            cart = [];
            updateCartUI();
            return;
        }

        cart = parsed
            .filter(item =>
                item &&
                typeof item.id === 'number' &&
                typeof item.name === 'string' &&
                Number.isFinite(Number(item.price)) &&
                Number.isFinite(Number(item.quantity)) &&
                Number(item.quantity) > 0
            )
            .map(item => ({
                id: Number(item.id),
                name: item.name,
                price: Number(item.price),
                image: String(item.image || ''),
                quantity: Math.max(1, Math.floor(Number(item.quantity)))
            }));

        updateCartUI();
    } catch (error) {
        console.error('Erreur chargement panier:', error);
        cart = [];
        updateCartUI();
    }
}

// Formater le prix
function formatPrice(price) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'XOF',
        maximumFractionDigits: 0
    }).format(Number(price) || 0);
}

// Notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');

    // Choisir la couleur selon le type de notification.
    const backgrounds = {
        success: 'linear-gradient(135deg, #27ae60, #229954)',
        error: 'linear-gradient(135deg, #e74c3c, #c0392b)',
        info: 'linear-gradient(135deg, #004E89, #0066BB)'
    };

    const background = backgrounds[type] || backgrounds.success;

    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${background};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        z-index: 2000;
        box-shadow: 0 8px 20px rgba(0,0,0,0.2);
        animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        font-weight: 600;
        max-width: 320px;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.4s ease';

        setTimeout(() => {
            notification.remove();
        }, 400);
    }, 3000);
}

// Animations CSS pour les notifications
const style = document.createElement('style');

style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;

document.head.appendChild(style);

// Fermer toutes les modales ouvertes
function closeActiveModal() {
    closeModal();
    closeCheckout();
}

// Fermer les modales avec Échap
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeActiveModal();
    }
});

// Fermer la bonne modal quand on clique sur le fond sombre
function initModalOutsideClick() {
    const productModal = document.getElementById('productModal');
    const checkoutModal = document.getElementById('checkoutModal');

    // Fermer la fiche produit si on clique sur le fond de la modal produit
    if (productModal) {
        productModal.addEventListener('click', function(event) {
            // On ferme seulement si le clic est sur le fond, pas sur le contenu
            if (event.target === productModal) {
                closeModal();
            }
        });
    }

    // Fermer la commande si on clique sur le fond de la modal commande
    if (checkoutModal) {
        checkoutModal.addEventListener('click', function(event) {
            // On ferme seulement si le clic est sur le fond, pas sur le formulaire
            if (event.target === checkoutModal) {
                closeCheckout();
            }
        });
    }
}

// Filtre actif des commandes admin
window.currentOrderStatusFilter = window.currentOrderStatusFilter || 'all';

// Filtrer les commandes dans l'admin selon la recherche et le statut
window.filterOrders = function() {
    const searchInput = document.getElementById('orderSearchInput');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let orders = getSavedOrders();

    // Filtrer par statut
    if (window.currentOrderStatusFilter !== 'all') {
        orders = orders.filter(order => {
            return (order.status || 'Nouvelle') === window.currentOrderStatusFilter;
        });
    }

    // Filtrer par recherche texte
    if (searchTerm) {
        orders = orders.filter(order => {
            const searchableText = [
                order.id,
                order.date,
                order.customer?.name,
                order.customer?.phone,
                order.customer?.email,
                order.customer?.address,
                order.payment,
                order.status,
                ...(Array.isArray(order.items) ? order.items.map(item => item.name) : [])
            ].join(' ').toLowerCase();

            return searchableText.includes(searchTerm);
        });
    }

    renderOrdersList(orders);
};

// Filtrer les commandes par statut
window.filterOrdersByStatus = function(status, clickedButton = null) {
    window.currentOrderStatusFilter = status;

    document.querySelectorAll('.status-filter-btn').forEach(button => {
        button.classList.remove('active');
    });

    if (clickedButton) {
        clickedButton.classList.add('active');
    }

    window.filterOrders();
};
// Imprimer une commande depuis l'admin
window.printOrder = function(orderId) {
    const id = Number(orderId);
    const orders = getSavedOrders();
    const order = orders.find(item => Number(item.id) === id);

    if (!order) {
        showNotification('Commande introuvable.', 'error');
        return;
    }

    const orderItems = Array.isArray(order.items) ? order.items : [];

    const itemsHTML = orderItems.map(item => `
        <tr>
            <td>${escapeHTML(item.name)}</td>
            <td>${Number(item.quantity)}</td>
            <td>${formatPrice(item.price)}</td>
            <td>${formatPrice(item.price * item.quantity)}</td>
        </tr>
    `).join('');

    const printContent = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Commande #${escapeHTML(order.id)}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 30px;
                    color: #222;
                }

                .invoice {
                    max-width: 800px;
                    margin: 0 auto;
                }

                h1 {
                    text-align: center;
                    color: #17823b;
                    margin-bottom: 5px;
                }

                .subtitle {
                    text-align: center;
                    margin-bottom: 30px;
                    color: #666;
                }

                .section {
                    margin-bottom: 25px;
                }

                .section h2 {
                    font-size: 18px;
                    border-bottom: 2px solid #17823b;
                    padding-bottom: 6px;
                    margin-bottom: 12px;
                }

                p {
                    margin: 6px 0;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }

                th, td {
                    border: 1px solid #ddd;
                    padding: 10px;
                    text-align: left;
                }

                th {
                    background: #f2f2f2;
                }

                .total {
                    text-align: right;
                    font-size: 20px;
                    font-weight: bold;
                    color: #17823b;
                    margin-top: 20px;
                }

                .footer {
                    margin-top: 40px;
                    text-align: center;
                    color: #777;
                    font-size: 14px;
                }

                @media print {
                    button {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="invoice">
                <h1>Ivoire Électroménagers</h1>
                <p class="subtitle">Bon de commande</p>

                <div class="section">
                    <h2>Informations commande</h2>
                    <p><strong>Commande :</strong> #${escapeHTML(order.id)}</p>
                    <p><strong>Date :</strong> ${escapeHTML(order.date)}</p>
                    <p><strong>Statut :</strong> ${escapeHTML(order.status || 'Nouvelle')}</p>
                    <p><strong>Paiement :</strong> ${escapeHTML(order.payment || '')}</p>
                </div>

                <div class="section">
                    <h2>Client</h2>
                    <p><strong>Nom :</strong> ${escapeHTML(order.customer?.name || '')}</p>
                    <p><strong>Téléphone :</strong> ${escapeHTML(order.customer?.phone || '')}</p>
                    <p><strong>Email :</strong> ${escapeHTML(order.customer?.email || 'Non fourni')}</p>
                    <p><strong>Adresse :</strong> ${escapeHTML(order.customer?.address || '')}</p>
                </div>

                <div class="section">
                    <h2>Articles commandés</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Article</th>
                                <th>Qté</th>
                                <th>Prix unitaire</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                        </tbody>
                    </table>

                    <div class="total">
                        Total : ${formatPrice(order.total)}
                    </div>
                </div>

                <div class="footer">
                    Merci pour votre confiance.
                </div>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                };
            <\/script>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');

    if (!printWindow) {
        showNotification('Impossible d’ouvrir la fenêtre d’impression.', 'error');
        return;
    }

    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
};

// Nettoyer le numéro du client pour WhatsApp
window.formatPhoneForWhatsApp = function(phone) {
    let cleanedPhone = String(phone || '').replace(/\D/g, '');

    // Si le client a écrit un numéro ivoirien commençant par 0,
    // on ajoute automatiquement l'indicatif 225.
    // Exemple : 0700000000 devient 2250700000000
    if (cleanedPhone.startsWith('0')) {
        cleanedPhone = `225${cleanedPhone}`;
    }

    return cleanedPhone;
};

// Envoyer un message WhatsApp au client depuis l'admin
window.sendOrderWhatsAppToClient = function(orderId) {
    const id = Number(orderId);
    const orders = getSavedOrders();
    const order = orders.find(item => Number(item.id) === id);

    if (!order) {
        showNotification('Commande introuvable.', 'error');
        return;
    }

    const customerPhone = window.formatPhoneForWhatsApp(order.customer?.phone);

    if (!customerPhone) {
        showNotification('Numéro client introuvable.', 'error');
        return;
    }

    const customerName = order.customer?.name || 'cher client';
    const orderStatus = order.status || 'Nouvelle';

    // Préparer la liste des articles pour le client.
    const items = Array.isArray(order.items)
        ? order.items.map((item, index) => {
            return `${index + 1}. ${item.name} x ${item.quantity} — ${formatPrice(Number(item.price) * Number(item.quantity))}`;
        }).join('\n')
        : 'Articles non disponibles';

    // Message adapté selon le statut.
    const statusMessages = {
        'Nouvelle': 'Votre commande a bien été reçue et sera traitée rapidement.',
        'En traitement': 'Votre commande est actuellement en cours de traitement.',
        'Livrée': 'Votre commande a été marquée comme livrée. Merci pour votre confiance.',
        'Annulée': 'Votre commande a été annulée. Contactez-nous si vous pensez qu’il s’agit d’une erreur.'
    };

    const statusMessage = statusMessages[orderStatus] || 'Votre commande est en cours de suivi.';

    const message = `
Bonjour ${customerName},

${statusMessage}

📋 Commande : #${order.id}
📅 Date : ${order.date || 'Non précisée'}
📦 Statut : ${orderStatus}

🛒 Articles :
${items}

💰 Total : ${formatPrice(order.total)}
💳 Paiement : ${order.payment || 'Non précisé'}

🚚 Livraison : Votre commande sera livrée sous 24H.

Pour toute question, vous pouvez répondre directement à ce message.

Merci pour votre confiance.
Ivoire Électroménagers
`.trim();

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customerPhone}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
};
async function fetchProductsFromDatabase() {
    try {
        // Récupère les produits actifs depuis Supabase.
        const { data, error } = await supabaseClient
            .from('products')
            .select('id, name, description, category, price, old_price, image, stock, is_promo, is_active')
            .eq('is_active', true)
            .order('id', { ascending: true });

        if (error) {
            console.error('Erreur chargement produits Supabase :', error);
            return;
        }

        // Conversion des noms de colonnes Supabase vers le format utilisé par ton site.
        databaseProducts = Array.isArray(data)
            ? data.map(product => ({
                id: Number(product.id),
                name: product.name,
                description: product.description || '',
                category: product.category,
                price: Number(product.price),
                oldPrice: product.old_price ? Number(product.old_price) : null,
                image: product.image || '',
                stock: Number(product.stock || 0),
                isPromo: Boolean(product.is_promo)
            }))
            : [];

    } catch (error) {
        console.error('Erreur connexion produits Supabase :', error);
    }
}

// ======================================================
// ADMIN SUPABASE — COMMANDES
// ======================================================

// Cache local des commandes chargées depuis Supabase.
// Il sert pour l'impression et WhatsApp sans refaire une requête.
let adminOrdersCache = [];

/**
 * Convertit une commande Supabase au format déjà utilisé par ton interface admin.
 */
function mapDatabaseOrderToAdminOrder(order, itemsByOrderId) {
    const orderItems = itemsByOrderId[String(order.id)] || [];

    return {
        id: Number(order.id),
        date: order.created_at
            ? new Date(order.created_at).toLocaleString('fr-FR')
            : '',
        customer: {
            name: order.customer_name || '',
            phone: order.customer_phone || '',
            email: order.customer_email || '',
            address: order.customer_address || ''
        },
        payment: order.payment_label || '',
        paymentMethod: order.payment_method || '',
        status: order.status || 'Nouvelle',
        total: Number(order.total || 0),
        items: orderItems.map(item => ({
            id: item.product_id ? Number(item.product_id) : Number(item.id),
            name: item.product_name || '',
            price: Number(item.unit_price || 0),
            quantity: Number(item.quantity || 0)
        }))
    };
}

/**
 * Charge les commandes et les articles commandés depuis Supabase.
 */
async function fetchOrdersFromDatabase() {
    try {
        // 1. Charger les commandes.
        const { data: orders, error: ordersError } = await supabaseClient
            .from('orders')
            .select(`
                id,
                customer_name,
                customer_phone,
                customer_email,
                customer_address,
                payment_method,
                payment_label,
                status,
                total,
                created_at
            `)
            .order('created_at', { ascending: false });

        if (ordersError) {
            throw ordersError;
        }

        if (!orders || orders.length === 0) {
            adminOrdersCache = [];
            return [];
        }

        const orderIds = orders.map(order => order.id);

        // 2. Charger les articles liés aux commandes.
        const { data: orderItems, error: itemsError } = await supabaseClient
            .from('order_items')
            .select(`
                id,
                order_id,
                product_id,
                product_name,
                quantity,
                unit_price,
                subtotal,
                created_at
            `)
            .in('order_id', orderIds);

        if (itemsError) {
            throw itemsError;
        }

        // 3. Grouper les articles par commande.
        const itemsByOrderId = {};

        (orderItems || []).forEach(item => {
            const key = String(item.order_id);

            if (!itemsByOrderId[key]) {
                itemsByOrderId[key] = [];
            }

            itemsByOrderId[key].push(item);
        });

        // 4. Convertir les commandes au format de ton admin.
        adminOrdersCache = orders.map(order => {
            return mapDatabaseOrderToAdminOrder(order, itemsByOrderId);
        });

        return adminOrdersCache;
    } catch (error) {
        console.error('Erreur chargement commandes Supabase:', error);
        showNotification('❌ Impossible de charger les commandes.', 'error');
        return [];
    }
}

/**
 * Affiche les commandes dans l'admin.
 */
function renderOrdersList(ordersToRender = null) {
    const ordersList = document.getElementById('ordersList');

    if (!ordersList) {
        return;
    }

    const orders = ordersToRender || adminOrdersCache;

    if (!Array.isArray(orders) || orders.length === 0) {
        ordersList.innerHTML = '<p class="admin-product-meta">Aucune commande enregistrée pour le moment.</p>';
        return;
    }

    ordersList.innerHTML = orders.map(order => {
        const items = Array.isArray(order.items) ? order.items : [];

        const itemsHTML = items.map(item => `
            <li>
                ${Number(item.quantity)} x ${escapeHTML(item.name)} —
                ${formatPrice(Number(item.price) * Number(item.quantity))}
            </li>
        `).join('');

        const currentStatus = order.status || 'Nouvelle';
        const statusClass = getOrderStatusClass(currentStatus);

        return `
            <div class="admin-order-item">
                <div class="admin-order-header">
                    <strong>Commande #${escapeHTML(order.id)}</strong>
                    <span>${escapeHTML(order.date)}</span>
                </div>

                <div class="admin-order-client">
                    <p><strong>Client :</strong> ${escapeHTML(order.customer?.name || '')}</p>
                    <p><strong>Téléphone :</strong> ${escapeHTML(order.customer?.phone || '')}</p>
                    <p><strong>Email :</strong> ${escapeHTML(order.customer?.email || 'Non fourni')}</p>
                    <p><strong>Adresse :</strong> ${escapeHTML(order.customer?.address || '')}</p>
                    <p><strong>Paiement :</strong> ${escapeHTML(order.payment || '')}</p>
                    <p>
                        <strong>Statut :</strong>
                        <span class="order-status-badge ${statusClass}">
                            ${escapeHTML(currentStatus)}
                        </span>
                    </p>
                </div>

                <ul class="admin-order-products">
                    ${itemsHTML}
                </ul>

                <div class="admin-order-footer">
                    <div class="admin-order-total">
                        Total : ${formatPrice(order.total)}
                    </div>

                    <div class="admin-order-actions">
                        <select class="admin-order-status" onchange="updateOrderStatus(${Number(order.id)}, this.value)">
                            <option value="Nouvelle" ${currentStatus === 'Nouvelle' ? 'selected' : ''}>Nouvelle</option>
                            <option value="En traitement" ${currentStatus === 'En traitement' ? 'selected' : ''}>En traitement</option>
                            <option value="Livrée" ${currentStatus === 'Livrée' ? 'selected' : ''}>Livrée</option>
                            <option value="Annulée" ${currentStatus === 'Annulée' ? 'selected' : ''}>Annulée</option>
                        </select>

                        <button class="btn btn-secondary" type="button" onclick="printOrder(${Number(order.id)})">
                            Imprimer
                        </button>

                        <button class="btn btn-secondary" type="button" onclick="sendOrderWhatsAppToClient(${Number(order.id)})">
                            WhatsApp client
                        </button>

                        <button class="admin-delete-btn" type="button" onclick="deleteOrder(${Number(order.id)})">
                            Supprimer
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Filtre les commandes selon recherche + statut.
 */
window.filterOrders = async function() {
    const searchInput = document.getElementById('orderSearchInput');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let orders = await fetchOrdersFromDatabase();

    // Filtrer par statut.
    if (window.currentOrderStatusFilter !== 'all') {
        orders = orders.filter(order => {
            return (order.status || 'Nouvelle') === window.currentOrderStatusFilter;
        });
    }

    // Filtrer par recherche texte.
    if (searchTerm) {
        orders = orders.filter(order => {
            const searchableText = [
                order.id,
                order.date,
                order.customer?.name,
                order.customer?.phone,
                order.customer?.email,
                order.customer?.address,
                order.payment,
                order.status,
                ...(Array.isArray(order.items) ? order.items.map(item => item.name) : [])
            ].join(' ').toLowerCase();

            return searchableText.includes(searchTerm);
        });
    }

    renderOrdersList(orders);
};

/**
 * Filtrer les commandes par statut.
 */
window.filterOrdersByStatus = async function(status, clickedButton = null) {
    window.currentOrderStatusFilter = status;

    document.querySelectorAll('.status-filter-btn').forEach(button => {
        button.classList.remove('active');
    });

    if (clickedButton) {
        clickedButton.classList.add('active');
    }

    await window.filterOrders();
};

/**
 * Mettre à jour le statut d'une commande dans Supabase.
 */
async function updateOrderStatus(orderId, status) {
    try {
        const id = Number(orderId);

        const { error } = await supabaseClient
            .from('orders')
            .update({ status })
            .eq('id', id);

        if (error) {
            throw error;
        }

        showNotification('Statut de la commande mis à jour.');

        await window.filterOrders();

        if (typeof updateAdminStats === 'function') {
            await updateAdminStats();
        }
    } catch (error) {
        console.error('Erreur mise à jour statut Supabase:', error);
        showNotification('❌ Impossible de modifier le statut.', 'error');
    }
}

/**
 * Supprimer une commande dans Supabase.
 */
async function deleteOrder(orderId) {
    const confirmDelete = confirm('Voulez-vous supprimer cette commande ?');

    if (!confirmDelete) {
        return;
    }

    try {
        const id = Number(orderId);

        // Supprimer d'abord les articles de la commande.
        const { error: itemsError } = await supabaseClient
            .from('order_items')
            .delete()
            .eq('order_id', id);

        if (itemsError) {
            throw itemsError;
        }

        // Supprimer ensuite la commande.
        const { error: orderError } = await supabaseClient
            .from('orders')
            .delete()
            .eq('id', id);

        if (orderError) {
            throw orderError;
        }

        showNotification('Commande supprimée.', 'info');

        await window.filterOrders();

        if (typeof updateAdminStats === 'function') {
            await updateAdminStats();
        }
    } catch (error) {
        console.error('Erreur suppression commande Supabase:', error);
        showNotification('❌ Impossible de supprimer la commande.', 'error');
    }
}

/**
 * Supprimer tout l'historique des commandes dans Supabase.
 */
async function clearOrders() {
    const confirmDelete = confirm('Voulez-vous vraiment supprimer toutes les commandes enregistrées ?');

    if (!confirmDelete) {
        return;
    }

    try {
        // Supprimer d'abord tous les articles.
        const { error: itemsError } = await supabaseClient
            .from('order_items')
            .delete()
            .neq('id', 0);

        if (itemsError) {
            throw itemsError;
        }

        // Supprimer ensuite toutes les commandes.
        const { error: ordersError } = await supabaseClient
            .from('orders')
            .delete()
            .neq('id', 0);

        if (ordersError) {
            throw ordersError;
        }

        adminOrdersCache = [];

        await window.filterOrders();

        if (typeof updateAdminStats === 'function') {
            await updateAdminStats();
        }

        showNotification('Historique des commandes supprimé.', 'info');
    } catch (error) {
        console.error('Erreur suppression historique Supabase:', error);
        showNotification('❌ Impossible de supprimer l’historique.', 'error');
    }
}

/**
 * Compatibilité si ton HTML appelle clearOrder().
 */
function clearOrder() {
    clearOrders();
}

/**
 * Imprimer une commande depuis les commandes Supabase chargées.
 */
window.printOrder = function(orderId) {
    const id = Number(orderId);
    const order = adminOrdersCache.find(item => Number(item.id) === id);

    if (!order) {
        showNotification('Commande introuvable.', 'error');
        return;
    }

    const orderItems = Array.isArray(order.items) ? order.items : [];

    const itemsHTML = orderItems.map(item => `
        <tr>
            <td>${escapeHTML(item.name)}</td>
            <td>${Number(item.quantity)}</td>
            <td>${formatPrice(item.price)}</td>
            <td>${formatPrice(item.price * item.quantity)}</td>
        </tr>
    `).join('');

    const printContent = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Commande #${escapeHTML(order.id)}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 30px;
                    color: #222;
                }

                .invoice {
                    max-width: 800px;
                    margin: 0 auto;
                }

                h1 {
                    text-align: center;
                    color: #17823b;
                    margin-bottom: 5px;
                }

                .subtitle {
                    text-align: center;
                    margin-bottom: 30px;
                    color: #666;
                }

                .section {
                    margin-bottom: 25px;
                }

                .section h2 {
                    font-size: 18px;
                    border-bottom: 2px solid #17823b;
                    padding-bottom: 6px;
                    margin-bottom: 12px;
                }

                p {
                    margin: 6px 0;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }

                th, td {
                    border: 1px solid #ddd;
                    padding: 10px;
                    text-align: left;
                }

                th {
                    background: #f2f2f2;
                }

                .total {
                    text-align: right;
                    font-size: 20px;
                    font-weight: bold;
                    color: #17823b;
                    margin-top: 20px;
                }

                .footer {
                    margin-top: 40px;
                    text-align: center;
                    color: #777;
                    font-size: 14px;
                }

                @media print {
                    button {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="invoice">
                <h1>Ivoire Électroménagers</h1>
                <p class="subtitle">Bon de commande</p>

                <div class="section">
                    <h2>Informations commande</h2>
                    <p><strong>Commande :</strong> #${escapeHTML(order.id)}</p>
                    <p><strong>Date :</strong> ${escapeHTML(order.date)}</p>
                    <p><strong>Statut :</strong> ${escapeHTML(order.status || 'Nouvelle')}</p>
                    <p><strong>Paiement :</strong> ${escapeHTML(order.payment || '')}</p>
                </div>

                <div class="section">
                    <h2>Client</h2>
                    <p><strong>Nom :</strong> ${escapeHTML(order.customer?.name || '')}</p>
                    <p><strong>Téléphone :</strong> ${escapeHTML(order.customer?.phone || '')}</p>
                    <p><strong>Email :</strong> ${escapeHTML(order.customer?.email || 'Non fourni')}</p>
                    <p><strong>Adresse :</strong> ${escapeHTML(order.customer?.address || '')}</p>
                </div>

                <div class="section">
                    <h2>Articles commandés</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Article</th>
                                <th>Qté</th>
                                <th>Prix unitaire</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                        </tbody>
                    </table>

                    <div class="total">
                        Total : ${formatPrice(order.total)}
                    </div>
                </div>

                <div class="footer">
                    Merci pour votre confiance.
                </div>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                };
            <\/script>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');

    if (!printWindow) {
        showNotification('Impossible d’ouvrir la fenêtre d’impression.', 'error');
        return;
    }

    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
};

/**
 * Envoyer un message WhatsApp au client depuis l'admin.
 */
window.sendOrderWhatsAppToClient = function(orderId) {
    const id = Number(orderId);
    const order = adminOrdersCache.find(item => Number(item.id) === id);

    if (!order) {
        showNotification('Commande introuvable.', 'error');
        return;
    }

    const customerPhone = window.formatPhoneForWhatsApp(order.customer?.phone);

    if (!customerPhone) {
        showNotification('Numéro client introuvable.', 'error');
        return;
    }

    const customerName = order.customer?.name || 'cher client';
    const orderStatus = order.status || 'Nouvelle';

    const items = Array.isArray(order.items)
        ? order.items.map((item, index) => {
            return `${index + 1}. ${item.name} x ${item.quantity} — ${formatPrice(Number(item.price) * Number(item.quantity))}`;
        }).join('\n')
        : 'Articles non disponibles';

    const statusMessages = {
        'Nouvelle': 'Votre commande a bien été reçue et sera traitée rapidement.',
        'En traitement': 'Votre commande est actuellement en cours de traitement.\n\n🚚 Livraison : Votre commande sera livrée sous 24H.',
        'Livrée': 'Votre commande a été marquée comme livrée. Merci pour votre confiance.',
        'Annulée': 'Votre commande a été annulée. Contactez-nous si vous pensez qu’il s’agit d’une erreur.'
    };

    const statusMessage = statusMessages[orderStatus] || 'Votre commande est en cours de suivi.';

    const message = `
Bonjour ${customerName},

${statusMessage}

📋 Commande : #${order.id}
📅 Date : ${order.date || 'Non précisée'}
📦 Statut : ${orderStatus}

🛒 Articles :
${items}

💰 Total : ${formatPrice(order.total)}
💳 Paiement : ${order.payment || 'Non précisé'}

Pour toute question, vous pouvez répondre directement à ce message.

Merci pour votre confiance.
Ivoire Électroménagers
`.trim();

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customerPhone}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
};

/**
 * Statistiques admin depuis Supabase.
 */
async function updateAdminStats() {
    const productsCountElement = document.getElementById('adminProductsCount');
    const ordersCountElement = document.getElementById('adminOrdersCount');

    if (!productsCountElement && !ordersCountElement) {
        return;
    }

    try {
        const { count: productsCount, error: productsError } = await supabaseClient
            .from('products')
            .select('*', { count: 'exact', head: true });

        if (productsError) {
            throw productsError;
        }

        const { count: ordersCount, error: ordersError } = await supabaseClient
            .from('orders')
            .select('*', { count: 'exact', head: true });

        if (ordersError) {
            throw ordersError;
        }

        if (productsCountElement) {
            productsCountElement.textContent = String(productsCount || 0);
        }

        if (ordersCountElement) {
            ordersCountElement.textContent = String(ordersCount || 0);
        }
    } catch (error) {
        console.error('Erreur statistiques admin Supabase:', error);
    }
}
async function toggleProductStatus(productId, currentStatus) {
    try {
        const { error } = await supabaseClient
            .from('products')
            .update({
                is_active: !currentStatus
            })
            .eq('id', Number(productId));

        if (error) {
            throw error;
        }

        showNotification('Produit mis à jour.');

        await renderCustomProductsList();

        if (document.getElementById('productsContainer')) {
            await loadProducts();
        }

        if (typeof updateAdminStats === 'function') {
            await updateAdminStats();
        }
    } catch (error) {
        console.error('Erreur changement statut produit Supabase:', error);
        showNotification('❌ Impossible de modifier le produit.', 'error');
    }
}
