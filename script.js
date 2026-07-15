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

// Vérifie si l'utilisateur revient d'un paiement en ligne PAYEMENT PRO,
// et vide le panier UNIQUEMENT si le paiement a réellement réussi.
async function checkPendingPaymentOnReturn() {
    const raw = localStorage.getItem('ivoirePendingPayment');
    if (!raw) return;

    let pending;
    try {
        pending = JSON.parse(raw);
    } catch (err) {
        localStorage.removeItem('ivoirePendingPayment');
        return;
    }

    async function fetchPaymentStatus() {
        const { data, error } = await supabaseClient
            .from('orders')
            .select('payment_status')
            .eq('id', pending.orderId)
            .single();
        if (error || !data) return null;
        return data.payment_status;
    }

    let status = await fetchPaymentStatus();

    if (status === 'pending') {
        await new Promise(resolve => setTimeout(resolve, 3000));
        status = await fetchPaymentStatus();
    }

    if (status === 'success') {
        cart = [];
        saveCart();
        updateCartUI();
        localStorage.removeItem('ivoirePendingPayment');
        showNotification('Paiement confirmé, merci pour votre commande !', 'success');
    } else if (status === 'failed') {
        localStorage.removeItem('ivoirePendingPayment');
        showNotification('Le paiement a échoué. Votre panier a été conservé.', 'error');
    } else {
        console.log('Statut de paiement encore indéterminé pour la commande', pending.orderId, ':', status);
    }
}

// Initialiser la page
document.addEventListener('DOMContentLoaded', async function() {
    // Charger le panier sur toutes les pages pour éviter d'écraser un panier existant.
    loadCart();

    // Si l'utilisateur revient d'un paiement en ligne, vérifie le statut
    // et vide le panier seulement si le paiement a réussi.
    await checkPendingPaymentOnReturn();

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
                <p class="product-description">${escapeHTML((product.description || '').replace(/<[^>]*>/g, '').substring(0, 120))}${(product.description || '').replace(/<[^>]*>/g, '').length > 120 ? '...' : ''}</p>
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

    if (!imageInput || !message) return;

    const nameInput        = document.getElementById('adminProductName');
    const priceInput       = document.getElementById('adminProductPrice');
    const categoryInput    = document.getElementById('adminProductCategory');
    const descriptionInput = document.getElementById('adminProductDescription');

    if (!nameInput || !priceInput || !categoryInput || !descriptionInput) {
        showAdminMessage(message, 'Formulaire incomplet.', '#e74c3c');
        return;
    }

    const name        = nameInput.value.trim();
    const price       = Number(priceInput.value);
    const category    = categoryInput.value;
    // Lire le HTML depuis l'éditeur Quill si disponible, sinon fallback sur le textarea
    const quillAddEditor = window.quillAdd;
    const description = quillAddEditor
        ? quillAddEditor.root.innerHTML.trim().replace(/<p><br><\/p>/g, '').trim()
        : descriptionInput.value.trim();
    const imageFiles  = Array.from(imageInput.files);
    const variantsInput = document.getElementById('adminProductVariants');
    const variantsRaw = variantsInput ? variantsInput.value.trim() : '';
    const variants = variantsRaw
        ? variantsRaw.split(',').map(function(v) { return v.trim(); }).filter(Boolean)
        : null;

    if (!name || !description || !Number.isFinite(price) || price <= 0 || !isValidCategory(category)) {
        showAdminMessage(message, 'Veuillez remplir correctement tous les champs.', '#e74c3c');
        return;
    }

    if (imageFiles.length === 0) {
        showAdminMessage(message, 'Veuillez choisir au moins une image.', '#e74c3c');
        return;
    }

    if (imageFiles.length > 5) {
        showAdminMessage(message, 'Maximum 5 images par produit.', '#e74c3c');
        return;
    }

    for (const file of imageFiles) {
        if (!file.type.startsWith('image/')) {
            showAdminMessage(message, file.name + ' n\'est pas une image valide.', '#e74c3c');
            return;
        }
        if (file.size > MAX_IMAGE_SIZE) {
            showAdminMessage(message, file.name + ' depasse la taille maximale de 1.5 Mo.', '#e74c3c');
            return;
        }
    }

    try {
        showAdminMessage(message, 'Verification admin...', '#555');

        const { data: userData, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !userData.user) {
            showAdminMessage(message, 'Session admin introuvable. Reconnectez-vous.', '#e74c3c');
            return;
        }

        const uploadedUrls = [];
        for (let i = 0; i < imageFiles.length; i++) {
            const file    = imageFiles[i];
            const fileExt = file.name.split('.').pop().toLowerCase();
            const fileName = Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + fileExt;
            const filePath = 'products/' + fileName;

            showAdminMessage(message, 'Upload image ' + (i + 1) + '/' + imageFiles.length + '...', '#555');

            const { error: uploadError } = await supabaseClient.storage
                .from('product-images')
                .upload(filePath, file, { contentType: file.type, upsert: false });

            if (uploadError) {
                console.error('Erreur upload image:', uploadError);
                showAdminMessage(message, 'Erreur upload image ' + (i + 1) + '. Voir console.', '#e74c3c');
                return;
            }

            const { data: publicUrlData } = supabaseClient.storage
                .from('product-images')
                .getPublicUrl(filePath);

            uploadedUrls.push(publicUrlData.publicUrl);
        }

        showAdminMessage(message, 'Enregistrement du produit...', '#555');

        const { data: insertedProduct, error: insertError } = await supabaseClient
            .from('products')
            .insert({
                name, description, category, price,
                image: uploadedUrls[0],
                stock: 1, is_promo: false, is_active: true,
                variants: variants
            })
            .select('id')
            .single();

        if (insertError) {
            console.error('Erreur insertion produit:', insertError);
            showAdminMessage(message, 'Erreur insertion produit. Voir console.', '#e74c3c');
            return;
        }

        const imageRows = uploadedUrls.map(function(url, index) {
            return { product_id: insertedProduct.id, url: url, position: index };
        });

        const { error: imgError } = await supabaseClient
            .from('product_images')
            .insert(imageRows);

        if (imgError) {
            console.error('Erreur insertion product_images:', imgError);
        }

        e.target.reset();
        if (window.quillAdd) window.quillAdd.root.innerHTML = '';
        showAdminMessage(message, 'Produit ajoute avec ' + uploadedUrls.length + ' photo(s).', '#17823b');

        if (typeof renderCustomProductsList === 'function') await renderCustomProductsList();
        if (document.getElementById('productsContainer')) await loadProducts();
        if (typeof updateAdminStats === 'function') await updateAdminStats();

    } catch (error) {
        console.error('Erreur generale ajout produit:', error);
        showAdminMessage(message, 'Impossible d\'ajouter le produit.', '#e74c3c');
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
    const { data: product, error } = await supabaseClient
        .from('products')
        .select('id, name, description, category, price, old_price, stock, is_promo, is_active, variants')
        .eq('id', productId)
        .single();

    if (error || !product) {
        showNotification('Impossible de charger le produit.', 'error');
        return;
    }

    document.getElementById('editProductId').value       = product.id;
    document.getElementById('editProductName').value     = product.name || '';
    document.getElementById('editProductDesc').value = product.description || '';
    // Pré-remplir l'éditeur Quill de modification
    const quillEditEditor = window.getQuillEdit ? window.getQuillEdit() : null;
    if (quillEditEditor) {
        quillEditEditor.root.innerHTML = product.description || '';
    }
    document.getElementById('editProductCat').value      = product.category || 'other';
    document.getElementById('editProductPrice').value    = product.price || '';
    document.getElementById('editProductOldPrice').value = product.old_price || '';
    document.getElementById('editProductStock').value    = product.stock || 0;
    document.getElementById('editProductPromo').checked  = Boolean(product.is_promo);
    document.getElementById('editProductActive').checked = Boolean(product.is_active);
    // Variantes de couleur
    const variantsInput = document.getElementById('editProductVariants');
    if (variantsInput) {
        variantsInput.value = (product.variants && Array.isArray(product.variants))
            ? product.variants.join(', ')
            : '';
    }

    // Charger les photos existantes depuis product_images (avec variant_color)
    const { data: existingImages } = await supabaseClient
        .from('product_images')
        .select('id, url, position, variant_color')
        .eq('product_id', productId)
        .order('position');

    const gallery = document.getElementById('editProductGallery');
    const currentVariants = (product.variants && Array.isArray(product.variants)) ? product.variants : [];

    if (gallery) {
        gallery.innerHTML = '';
        const imgs = (existingImages && existingImages.length > 0)
            ? existingImages
            : (product.image ? [{ id: null, url: product.image, position: 0, variant_color: null }] : []);

        imgs.forEach(function(img) {
            const div = document.createElement('div');
            div.className = 'edit-gallery-thumb';
            div.style.width = 'auto';
            div.style.height = 'auto';
            div.style.flexDirection = 'column';
            div.style.alignItems = 'center';
            div.style.gap = '4px';

            // Options de couleur pour ce select
            const colorOptions = '<option value="">Commune (toutes couleurs)</option>' +
                currentVariants.map(function(c) {
                    return '<option value="' + c + '"' + (img.variant_color === c ? ' selected' : '') + '>' + c + '</option>';
                }).join('');

            div.innerHTML =
                '<div style="position:relative;width:72px;height:72px;">' +
                    '<img src="' + img.url + '" alt="photo" style="width:100%;height:100%;object-fit:cover;border-radius:8px;border:2px solid #ddd;">' +
                    (img.id ? '<button type="button" data-imgid="' + img.id + '" onclick="deleteProductImageById(this)" title="Supprimer" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;background:#e74c3c;color:white;border:none;border-radius:50%;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>' : '') +
                '</div>' +
                (img.id ? '<select onchange="updateImageColor(\'' + img.id + '\', this.value)" style="font-size:0.75rem;border:1px solid #ddd;border-radius:4px;padding:2px 4px;max-width:90px;">' + colorOptions + '</select>' : '<span style="font-size:0.75rem;color:#999;">Principale</span>');

            gallery.appendChild(div);
        });
    }

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
    const quillEditEditor = window.getQuillEdit ? window.getQuillEdit() : null;
    const description = quillEditEditor
        ? quillEditEditor.root.innerHTML.trim().replace(/<p><br><\/p>/g, '').trim()
        : document.getElementById('editProductDesc').value.trim();
    const category    = document.getElementById('editProductCat').value;
    const price       = parseFloat(document.getElementById('editProductPrice').value);
    const oldPriceRaw = document.getElementById('editProductOldPrice').value.trim();
    const old_price   = oldPriceRaw !== '' ? parseFloat(oldPriceRaw) : null;
    const stock       = parseInt(document.getElementById('editProductStock').value, 10);
    const is_promo    = document.getElementById('editProductPromo').checked;
    const is_active   = document.getElementById('editProductActive').checked;
    const variantsRaw = document.getElementById('editProductVariants')
        ? document.getElementById('editProductVariants').value.trim()
        : '';
    const variants = variantsRaw
        ? variantsRaw.split(',').map(function(v) { return v.trim(); }).filter(Boolean)
        : null;
    const newImageInput = document.getElementById('editProductImages');
    const newFiles    = newImageInput ? Array.from(newImageInput.files) : [];

    if (!name) { showNotification('Le nom du produit est obligatoire.', 'error'); return; }
    if (!Number.isFinite(price) || price <= 0) { showNotification('Le prix doit etre un nombre positif.', 'error'); return; }
    if (old_price !== null && (!Number.isFinite(old_price) || old_price <= 0)) { showNotification('Le prix barre doit etre un nombre positif (ou vide).', 'error'); return; }
    if (!isValidCategory(category)) { showNotification('Categorie invalide.', 'error'); return; }
    if (newFiles.length > 5) { showNotification('Maximum 5 nouvelles images.', 'error'); return; }

    try {
        // 1. Mise à jour des champs texte
        const { error } = await supabaseClient
            .from('products')
            .update({ name, description, category, price, old_price, stock, is_promo, is_active, variants: variants })
            .eq('id', id);

        if (error) throw error;

        // 2. Upload des nouvelles photos si présentes
        if (newFiles.length > 0) {
            const { data: existingImgs } = await supabaseClient
                .from('product_images')
                .select('id')
                .eq('product_id', id);

            const currentCount = existingImgs ? existingImgs.length : 0;

            // Récupérer les couleurs associées à chaque nouvelle photo (depuis les selects)
            const colorSelects = document.querySelectorAll('.new-image-color-select');

            for (let i = 0; i < newFiles.length; i++) {
                const file    = newFiles[i];
                const fileExt = file.name.split('.').pop().toLowerCase();
                const fileName = Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + fileExt;
                const filePath = 'products/' + fileName;

                const { error: uploadError } = await supabaseClient.storage
                    .from('product-images')
                    .upload(filePath, file, { contentType: file.type, upsert: false });

                if (uploadError) {
                    console.error('Erreur upload nouvelle image:', uploadError);
                    continue;
                }

                const { data: urlData } = supabaseClient.storage
                    .from('product-images')
                    .getPublicUrl(filePath);

                const variantColor = (colorSelects[i] && colorSelects[i].value) ? colorSelects[i].value : null;

                await supabaseClient.from('product_images').insert({
                    product_id: id,
                    url: urlData.publicUrl,
                    position: currentCount + i,
                    variant_color: variantColor
                });

                if (currentCount === 0 && i === 0) {
                    await supabaseClient.from('products').update({ image: urlData.publicUrl }).eq('id', id);
                }
            }

            if (newImageInput) newImageInput.value = '';
            // Nettoyer les selects de couleur
            document.querySelectorAll('.new-image-color-select').forEach(function(s) { s.remove(); });
            const colorPreview = document.getElementById('newImagesColorAssign');
            if (colorPreview) colorPreview.innerHTML = '';
        }

        showNotification('Produit mis a jour.', 'success');
        closeEditProductModal();

        if (typeof renderCustomProductsList === 'function') await renderCustomProductsList();
        if (document.getElementById('productsContainer')) await loadProducts();

    } catch (err) {
        console.error('Erreur mise a jour produit:', err);
        showNotification('Impossible de mettre a jour le produit.', 'error');
    }
}

function deleteProductImageById(btn) {
    const imageId = btn.dataset.imgid;
    const thumbEl = btn.closest('.edit-gallery-thumb');
    deleteProductImage(imageId, thumbEl);
}

async function deleteProductImage(imageId, thumbEl) {
    if (!confirm('Supprimer cette photo ?')) return;

    const { error } = await supabaseClient
        .from('product_images')
        .delete()
        .eq('id', imageId);

    if (error) {
        console.error('Erreur suppression image:', error);
        showNotification('Impossible de supprimer la photo.', 'error');
        return;
    }

    if (thumbEl) thumbEl.remove();
    showNotification('Photo supprimee.', 'success');
}

function previewNewImages(input) {
    const preview = document.getElementById('newImagesColorAssign');
    if (!preview) return;
    preview.innerHTML = '';

    // Récupérer les variantes disponibles pour ce produit
    const variantsInput = document.getElementById('editProductVariants');
    const variantsRaw = variantsInput ? variantsInput.value.trim() : '';
    const variants = variantsRaw
        ? variantsRaw.split(',').map(function(v) { return v.trim(); }).filter(Boolean)
        : [];

    Array.from(input.files).forEach(function(file, index) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;';

            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.cssText = 'width:72px;height:72px;object-fit:cover;border-radius:8px;border:2px solid #1a73e8;';

            const colorOptions = '<option value="">Commune</option>' +
                variants.map(function(c) {
                    return '<option value="' + c + '">' + c + '</option>';
                }).join('');

            const select = document.createElement('select');
            select.className = 'new-image-color-select';
            select.innerHTML = colorOptions;
            select.style.cssText = 'font-size:0.75rem;border:1px solid #ddd;border-radius:4px;padding:2px 4px;max-width:90px;';

            div.appendChild(img);
            if (variants.length > 0) div.appendChild(select);
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

async function updateImageColor(imageId, color) {
    const { error } = await supabaseClient
        .from('product_images')
        .update({ variant_color: color || null })
        .eq('id', imageId);

    if (error) {
        console.error('Erreur mise a jour couleur image:', error);
        showNotification('Impossible d\'associer la couleur a cette photo.', 'error');
    }
}

// ─── Système d'avis clients ───────────────────────────────────────────────────

let _currentRating = 0;

function setRating(value) {
    _currentRating = value;
    // Cibler uniquement les étoiles dans le formulaire d'avis (pas les étoiles d'affichage)
    var stars = document.querySelectorAll('#starRating .star-btn');
    stars.forEach(function(star) {
        star.style.opacity = Number(star.dataset.value) <= value ? '1' : '0.35';
    });
}

function toggleReviewForm() {
    const form = document.getElementById('reviewForm');
    if (!form) return;
    const isVisible = form.style.display !== 'none';
    form.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        var ref = document.getElementById('reviewRef');
        var email = document.getElementById('reviewEmail');
        var comment = document.getElementById('reviewComment');
        var msg = document.getElementById('reviewMessage');
        if (ref) ref.value = '';
        if (email) email.value = '';
        if (comment) comment.value = '';
        if (msg) msg.textContent = '';
        _currentRating = 0;
        document.querySelectorAll('#starRating .star-btn').forEach(function(s) { s.style.opacity = '0.35'; });
    }
}

async function loadReviews(productId) {
    const container = document.getElementById('reviewsList');
    if (!container) return;

    const { data: reviews, error } = await supabaseClient
        .from('reviews')
        .select('customer_name, rating, comment, created_at, verified')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

    const ratingEl = document.getElementById('modalRating');

    if (error || !reviews || reviews.length === 0) {
        container.innerHTML = '<p style="color:#888;font-size:0.85rem;text-align:center;padding:1rem 0;">Aucun avis pour ce produit. Soyez le premier à en laisser un !</p>';
        if (ratingEl) ratingEl.textContent = 'Aucun avis';
        return;
    }

    // Note moyenne
    const avg = reviews.reduce(function(sum, r) { return sum + r.rating; }, 0) / reviews.length;
    const avgStr = avg.toFixed(1);
    const starsDisplay = '⭐'.repeat(Math.round(avg));
    if (ratingEl) ratingEl.textContent = starsDisplay + ' ' + avgStr + '/5 (' + reviews.length + ' avis)';

    container.innerHTML = reviews.map(function(r) {
        const date = new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
        const starsStr = '⭐'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        return '<div style="border-bottom:1px solid #f0f0f0;padding:12px 0;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
                '<div>' +
                    '<strong style="font-size:0.9rem;color:#1a1a2e;">' + escapeHTML(r.customer_name) + '</strong>' +
                    (r.verified ? ' <span style="font-size:0.72rem;color:#16a34a;background:#d4edda;padding:2px 6px;border-radius:10px;">✅ Achat vérifié</span>' : '') +
                '</div>' +
                '<span style="font-size:0.75rem;color:#aaa;">' + date + '</span>' +
            '</div>' +
            '<div style="font-size:1rem;margin-bottom:4px;">' + starsStr + '</div>' +
            (r.comment ? '<p style="font-size:0.85rem;color:#444;margin:0;">' + escapeHTML(r.comment) + '</p>' : '') +
        '</div>';
    }).join('');
}

async function submitReview() {
    const refInput    = document.getElementById('reviewRef');
    const emailInput  = document.getElementById('reviewEmail');
    const commentInput= document.getElementById('reviewComment');
    const msg         = document.getElementById('reviewMessage');
    const btn         = document.getElementById('submitReviewBtn');

    if (!refInput || !emailInput || !msg || !btn) return;

    const ref     = refInput.value.trim().toUpperCase();
    const email   = emailInput.value.trim().toLowerCase();
    const comment = commentInput ? commentInput.value.trim() : '';

    if (!ref || !ref.startsWith('CMD-')) {
        msg.style.color = '#e74c3c';
        msg.textContent = 'Veuillez entrer une référence de commande valide (CMD-...).';
        return;
    }
    if (!email) {
        msg.style.color = '#e74c3c';
        msg.textContent = 'Veuillez entrer votre email.';
        return;
    }
    if (_currentRating === 0) {
        msg.style.color = '#e74c3c';
        msg.textContent = 'Veuillez sélectionner une note (1 à 5 étoiles).';
        return;
    }

    btn.disabled = true;
    msg.style.color = '#555';
    msg.textContent = 'Vérification en cours...';

    // Vérifier commande + email
    const { data: order, error: orderError } = await supabaseClient
        .from('orders')
        .select('id, customer_name')
        .eq('payment_reference', ref)
        .ilike('customer_email', email)
        .single();

    if (orderError || !order) {
        msg.style.color = '#e74c3c';
        msg.textContent = 'Commande introuvable. Vérifiez votre référence et votre email.';
        btn.disabled = false;
        return;
    }

    // Vérifier que la commande contient ce produit
    const { data: items } = await supabaseClient
        .from('order_items')
        .select('id')
        .eq('order_id', order.id)
        .ilike('product_name', '%' + (currentProduct ? currentProduct.name.substring(0, 10) : '') + '%');

    if (!items || items.length === 0) {
        msg.style.color = '#e74c3c';
        msg.textContent = 'Ce produit ne fait pas partie de votre commande.';
        btn.disabled = false;
        return;
    }

    // Vérifier qu'il n'a pas déjà laissé un avis
    const { data: existing } = await supabaseClient
        .from('reviews')
        .select('id')
        .eq('product_id', currentProduct.id)
        .eq('order_reference', ref);

    if (existing && existing.length > 0) {
        msg.style.color = '#e74c3c';
        msg.textContent = 'Vous avez déjà laissé un avis pour ce produit.';
        btn.disabled = false;
        return;
    }

    // Insérer l'avis
    const { error: insertError } = await supabaseClient
        .from('reviews')
        .insert({
            product_id: currentProduct.id,
            order_reference: ref,
            customer_name: order.customer_name,
            customer_email: email,
            rating: _currentRating,
            comment: comment || null,
            verified: true
        });

    if (insertError) {
        console.error('Erreur insertion avis:', insertError);
        msg.style.color = '#e74c3c';
        msg.textContent = 'Une erreur est survenue. Réessayez.';
        btn.disabled = false;
        return;
    }

    msg.style.color = '#16a34a';
    msg.textContent = 'Merci pour votre avis ! Il est maintenant publié.';
    btn.disabled = false;

    // Recharger les avis
    setTimeout(function() {
        toggleReviewForm();
        loadReviews(currentProduct.id);
    }, 1500);
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
async function openProductModal(productId) {
    const id = Number(productId);
    currentProduct = getCatalogProducts().find(function(p) { return p.id === id; });
    currentQuantity = 1;

    if (!currentProduct) return;

    const modalImage       = document.getElementById('modalImage');
    const modalTitle       = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const modalPrice       = document.getElementById('modalPrice');
    const quantityInput    = document.getElementById('quantityInput');
    const productModal     = document.getElementById('productModal');
    const modalOverlay     = document.getElementById('modalOverlay');

    if (!modalImage || !modalTitle || !modalDescription || !modalPrice || !quantityInput || !productModal || !modalOverlay) return;

    // Charger les images depuis product_images (avec variant_color)
    const { data: productImages } = await supabaseClient
        .from('product_images')
        .select('url, position, variant_color')
        .eq('product_id', id)
        .order('position');

    // imagesByColor : map couleur -> url (pour changer la photo au clic)
    window._imagesByColor = {};
    window._defaultImage = null;

    const allImages = (productImages && productImages.length > 0)
        ? productImages
        : (currentProduct.image ? [{ url: getSafeImageSrc(currentProduct.image), position: 0, variant_color: null }] : []);

    allImages.forEach(function(img) {
        if (img.variant_color) {
            window._imagesByColor[img.variant_color] = img.url;
        } else if (!window._defaultImage) {
            window._defaultImage = img.url;
        }
    });

    const images = allImages.map(function(img) { return img.url; });

    // Afficher la première image
    modalImage.src = images[0] || '';
    modalImage.alt = currentProduct.name;
    modalImage.style.cursor = images.length > 1 ? 'pointer' : 'default';

    // Galerie miniatures - supprimer l'ancienne galerie et en créer une nouvelle
    const oldGallery = document.getElementById('modalGallery');
    if (oldGallery) oldGallery.remove();

    const commonImages = allImages.filter(function(img) { return !img.variant_color; });
    if (commonImages.length > 1) {
        const gallery = document.createElement('div');
        gallery.id = 'modalGallery';
        gallery.style.cssText = 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;justify-content:center;';
        modalImage.parentNode.insertBefore(gallery, modalImage.nextSibling);

        commonImages.forEach(function(imgObj, index) {
            const thumb = document.createElement('img');
            thumb.src = imgObj.url;
            thumb.alt = 'Photo ' + (index + 1);
            thumb.style.cssText = 'width:60px;height:60px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid ' + (index === 0 ? '#1a73e8' : '#ddd') + ';transition:border-color 0.2s;';
            thumb.onclick = function() {
                modalImage.src = imgObj.url;
                gallery.querySelectorAll('img').forEach(function(t) { t.style.borderColor = '#ddd'; });
                thumb.style.borderColor = '#1a73e8';
            };
            gallery.appendChild(thumb);
        });
    }

    modalTitle.textContent       = currentProduct.name;
    // Afficher la description en HTML (pour la mise en forme Quill)
    modalDescription.innerHTML = currentProduct.description || '';
    modalPrice.textContent       = formatPrice(currentProduct.price);
    quantityInput.value          = '1';

    // Afficher les variantes de couleur si disponibles
    let variantContainer = document.getElementById('modalVariants');
    if (!variantContainer) {
        variantContainer = document.createElement('div');
        variantContainer.id = 'modalVariants';
        variantContainer.style.cssText = 'margin:12px 0;';
        const priceEl = document.getElementById('modalPrice');
        if (priceEl && priceEl.parentNode) {
            priceEl.parentNode.insertBefore(variantContainer, priceEl.nextSibling);
        }
    }
    variantContainer.innerHTML = '';

    if (currentProduct.variants && Array.isArray(currentProduct.variants) && currentProduct.variants.length > 0) {
        const label = document.createElement('p');
        label.style.cssText = 'font-size:0.85rem;color:#666;margin-bottom:8px;font-weight:600;';
        label.textContent = 'Couleur :';
        variantContainer.appendChild(label);

        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';

        currentProduct.variants.forEach(function(color, index) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = color;
            btn.dataset.color = color;
            btn.style.cssText = 'padding:6px 14px;border-radius:20px;border:2px solid #ddd;background:white;cursor:pointer;font-size:0.85rem;transition:all 0.15s;';
            if (index === 0) {
                btn.style.borderColor = '#1a73e8';
                btn.style.color = '#1a73e8';
                btn.style.fontWeight = '600';
                window._selectedVariant = color;
            }
            btn.onclick = function() {
                btnGroup.querySelectorAll('button').forEach(function(b) {
                    b.style.borderColor = '#ddd';
                    b.style.color = '#333';
                    b.style.fontWeight = 'normal';
                });
                btn.style.borderColor = '#1a73e8';
                btn.style.color = '#1a73e8';
                btn.style.fontWeight = '600';
                window._selectedVariant = color;
                // Changer la photo principale si une image est associée à cette couleur
                const colorImage = window._imagesByColor && window._imagesByColor[color];
                if (colorImage) {
                    modalImage.src = colorImage;
                    window._selectedVariantImage = colorImage;
                } else if (window._defaultImage) {
                    modalImage.src = window._defaultImage;
                    window._selectedVariantImage = window._defaultImage;
                } else {
                    window._selectedVariantImage = null;
                }
            };
            btnGroup.appendChild(btn);
        });

        variantContainer.appendChild(btnGroup);
        if (currentProduct.variants.length > 0) {
            window._selectedVariant = currentProduct.variants[0];
            const firstColorImage = window._imagesByColor && window._imagesByColor[currentProduct.variants[0]];
            window._selectedVariantImage = firstColorImage || window._defaultImage || null;
        }
    } else {
        window._selectedVariant = null;
    }

    productModal.classList.add('open');
    modalOverlay.classList.add('open');

    // Charger les avis pour ce produit
    loadReviews(id);
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

    // Vérifier qu'une couleur est sélectionnée si le produit a des variantes
    if (currentProduct.variants && currentProduct.variants.length > 0 && !window._selectedVariant) {
        showNotification('Veuillez choisir une couleur.', 'error');
        return;
    }

    addToCartWithVariant(currentProduct.id, quantity, window._selectedVariant || null, window._selectedVariantImage || null);
    window._selectedVariant = null;
    window._selectedVariantImage = null;
    closeModal();
    showNotification('Produit ajouté au panier !');
}

function addToCartWithVariant(productId, quantity, variant, variantImage) {
    const id = Number(productId);
    const cleanQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    const product = getCatalogProducts().find(function(item) { return item.id === id; });

    if (!product) {
        showNotification('Produit introuvable.', 'error');
        return;
    }

    const cartProduct = variant
        ? Object.assign({}, product, {
            selectedVariant: variant,
            cartKey: id + '-' + variant,
            image: variantImage || product.image
          })
        : Object.assign({}, product, { cartKey: String(id) });

    addProductToCart(cartProduct, cleanQuantity);
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
    // cartKey permet d'avoir le même produit en plusieurs couleurs dans le panier
    const cartKey = product.cartKey || String(product.id);
    const existingItem = cart.find(function(item) { return (item.cartKey || String(item.id)) === cartKey; });

    if (existingItem) {
        existingItem.quantity += cleanQuantity;
    } else {
        cart.push({
            id: Number(product.id),
            cartKey: cartKey,
            name: product.name,
            price: Number(product.price),
            image: product.image,
            quantity: cleanQuantity,
            selectedVariant: product.selectedVariant || null
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

// Retirer par cartKey (supporte les variantes)
function removeFromCartByKey(cartKey) {
    cart = cart.filter(function(item) { return (item.cartKey || String(item.id)) !== String(cartKey); });
    saveCart();
    updateCartUI();
}

// Changer la quantité par cartKey (supporte les variantes)
function updateCartQuantityByKey(cartKey, change) {
    const item = cart.find(function(i) { return (i.cartKey || String(i.id)) === String(cartKey); });
    if (!item) return;
    item.quantity += Number(change);
    if (item.quantity <= 0) {
        removeFromCartByKey(cartKey);
        return;
    }
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
        const cartKey = item.cartKey || String(item.id);
        const variantLabel = item.selectedVariant
            ? ` <span style="color:#1a73e8;font-size:0.8rem;">(${escapeHTML(item.selectedVariant)})</span>`
            : '';

        return `
            <div class="cart-item">
                <img src="${escapeAttribute(safeImage)}" alt="${escapeAttribute(item.name)}" class="cart-item-image">
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHTML(item.name)}${variantLabel}</div>
                    <div class="cart-item-unit-price">Prix unitaire: ${formatPrice(item.price)}</div>
                    <div class="cart-item-price">Total: ${formatPrice(item.price * item.quantity)}</div>
                </div>
                <div class="cart-item-qty">
                    <button type="button" onclick="updateCartQuantityByKey('${cartKey}', -1)">−</button>
                    <span>${Number(item.quantity)}</span>
                    <button type="button" onclick="updateCartQuantityByKey('${cartKey}', 1)">+</button>
                    <button class="remove-btn" type="button" onclick="removeFromCartByKey('${cartKey}')">✕</button>
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

    // Envoyer l'email "commande reçue" au client (best-effort).
    try {
        const { error: emailError } = await supabaseClient.functions.invoke('send-order-email', {
            body: { order_id: orderId, type: 'created' }
        });
        if (emailError) {
            console.error('Erreur envoi email commande créée:', emailError);
        }
    } catch (err) {
        console.error('Exception envoi email commande créée:', err);
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

        // Sauvegarde un marqueur local pour verifier le statut au retour sur le site.
        localStorage.setItem('ivoirePendingPayment', JSON.stringify({
            orderId: order.id,
            reference: paymentReference
        }));

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
    const showUnpaid = document.getElementById('showUnpaidOrders');
    const showAll = showUnpaid ? showUnpaid.checked : true;

    let orders = getSavedOrders();

    // Masquer les commandes non payées (pending/failed) par défaut
    if (!showAll) {
        orders = orders.filter(function(order) {
            const ps = (order.payment_status || order.paymentStatus || '').toLowerCase();
            return ps !== 'pending' && ps !== 'failed' && ps !== '';
        });
    }

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
            .select('id, name, description, category, price, old_price, image, stock, is_promo, is_active, variants')
            .eq('is_active', true)
            .order('id', { ascending: false });

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
                isPromo: Boolean(product.is_promo),
                variants: product.variants || null
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
        payment_status: order.payment_status || '',
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
                payment_status,
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
        const paymentStatus = (order.payment_status || '').toLowerCase();
        const isPending = paymentStatus === 'pending';
        const isFailed = paymentStatus === 'failed';
        const unpaidBanner = isPending
            ? '<div style="background:#fff3cd;color:#856404;padding:6px 12px;font-size:0.8rem;border-radius:6px;margin-bottom:8px;">⏳ Paiement en attente — commande non confirmée</div>'
            : isFailed
            ? '<div style="background:#fde8e8;color:#c0392b;padding:6px 12px;font-size:0.8rem;border-radius:6px;margin-bottom:8px;">❌ Paiement échoué — commande non confirmée</div>'
            : '';

        return `
            <div class="admin-order-item" style="${isPending || isFailed ? 'opacity:0.7;' : ''}">
                ${unpaidBanner}
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