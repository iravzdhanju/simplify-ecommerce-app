/**
 * Shopify GraphQL queries and mutations
 * Based on 2025-01 API version with advanced features
 */

// Product Queries
export const GET_PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      edges {
        node {
          id
          title
          handle
          description
          productType
          vendor
          tags
          status
          createdAt
          updatedAt
          totalInventory
          tracksInventory
          options {
            id
            name
            position
            values
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                price
                compareAtPrice
                inventoryQuantity
                sku
                barcode
                weight
                weightUnit
                requiresShipping
                taxable
                inventoryPolicy
                fulfillmentService {
                  serviceName
                }
                selectedOptions {
                  name
                  value
                }
                image {
                  url
                  altText
                }
                metafields(first: 10) {
                  edges {
                    node {
                      namespace
                      key
                      value
                      type
                    }
                  }
                }
              }
            }
          }
          images(first: 10) {
            edges {
              node {
                url
                altText
                width
                height
              }
            }
          }
          seo {
            title
            description
          }
          metafields(first: 20) {
            edges {
              node {
                namespace
                key
                value
                type
                description
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`

export const GET_PRODUCT_BY_ID_QUERY = `
  query GetProduct($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      description
      descriptionHtml
      productType
      vendor
      tags
      status
      createdAt
      updatedAt
      publishedAt
      totalInventory
      tracksInventory
      options {
        id
        name
        position
        values
      }
      variants(first: 250) {
        edges {
          node {
            id
            title
            price
            compareAtPrice
            inventoryQuantity
            availableForSale
            sku
            barcode
            weight
            weightUnit
            requiresShipping
            taxable
            inventoryPolicy
            fulfillmentService {
              serviceName
            }
            selectedOptions {
              name
              value
            }
            image {
              url
              altText
            }
            inventoryItem {
              id
              tracked
              requiresShipping
            }
            metafields(first: 20) {
              edges {
                node {
                  namespace
                  key
                  value
                  type
                }
              }
            }
          }
        }
      }
      images(first: 20) {
        edges {
          node {
            url
            altText
            width
            height
          }
        }
      }
      seo {
        title
        description
      }
      metafields(first: 50) {
        edges {
          node {
            namespace
            key
            value
            type
            description
          }
        }
      }
    }
  }
`

// Product Mutations
export const CREATE_PRODUCT_MUTATION = `
  mutation CreateProduct($input: ProductInput!) {
    productCreate(input: $input) {
      product {
        id
        title
        handle
        status
        createdAt
        variants(first: 100) {
          edges {
            node {
              id
              title
              price
              inventoryQuantity
              sku
            }
          }
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

export const UPDATE_PRODUCT_MUTATION = `
  mutation UpdateProduct($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        title
        handle
        status
        updatedAt
        variants(first: 100) {
          edges {
            node {
              id
              title
              price
              inventoryQuantity
              sku
            }
          }
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

export const DELETE_PRODUCT_MUTATION = `
  mutation DeleteProduct($input: ProductDeleteInput!) {
    productDelete(input: $input) {
      deletedProductId
      userErrors {
        field
        message
        code
      }
    }
  }
`

// Variant Mutations
export const CREATE_PRODUCT_VARIANT_MUTATION = `
  mutation CreateProductVariant($input: ProductVariantInput!) {
    productVariantCreate(input: $input) {
      productVariant {
        id
        title
        price
        compareAtPrice
        inventoryQuantity
        sku
        barcode
        weight
        selectedOptions {
          name
          value
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

export const UPDATE_PRODUCT_VARIANT_MUTATION = `
  mutation UpdateProductVariant($input: ProductVariantInput!) {
    productVariantUpdate(input: $input) {
      productVariant {
        id
        title
        price
        compareAtPrice
        inventoryQuantity
        sku
        barcode
        weight
        updatedAt
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

export const BULK_UPDATE_VARIANTS_MUTATION = `
  mutation BulkUpdateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      product {
        id
        variants(first: 250) {
          edges {
            node {
              id
              price
              compareAtPrice
              inventoryQuantity
              sku
              updatedAt
            }
          }
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

// Inventory Queries and Mutations
export const GET_INVENTORY_LEVELS_QUERY = `
  query GetInventoryLevels($productVariantIds: [ID!]!) {
    productVariants(first: 250) {
      edges {
        node {
          id
          sku
          inventoryItem {
            id
            tracked
            inventoryLevels(first: 10) {
              edges {
                node {
                  id
                  available
                  location {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`

export const ADJUST_INVENTORY_MUTATION = `
  mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!) {
    inventoryAdjustQuantities(input: $input) {
      inventoryAdjustmentGroup {
        id
        reason
        referenceDocumentUri
        changes {
          name
          delta
          quantityAfterChange
          item {
            id
            sku
          }
          location {
            id
            name
          }
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

// Media Mutations
export const CREATE_STAGED_UPLOADS_MUTATION = `
  mutation CreateStagedUploads($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

export const CREATE_PRODUCT_MEDIA_MUTATION = `
  mutation CreateProductMedia($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media {
        id
        mediaContentType
        status
        ... on MediaImage {
          image {
            url
            altText
          }
        }
      }
      mediaUserErrors {
        field
        message
        code
      }
    }
  }
`

// Metafield Mutations
export const SET_METAFIELDS_MUTATION = `
  mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
        type
        ownerResource {
          ... on Product {
            id
            title
          }
          ... on ProductVariant {
            id
            title
          }
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

// Bulk Operation Queries
export const BULK_PRODUCTS_QUERY = `
  {
    products {
      edges {
        node {
          id
          title
          handle
          description
          productType
          vendor
          tags
          status
          createdAt
          updatedAt
          totalInventory
          variants {
            edges {
              node {
                id
                title
                price
                compareAtPrice
                inventoryQuantity
                sku
                barcode
                selectedOptions {
                  name
                  value
                }
                inventoryItem {
                  id
                  tracked
                }
              }
            }
          }
          images {
            edges {
              node {
                id
                url
                altText
                width
                height
              }
            }
          }
          metafields {
            edges {
              node {
                namespace
                key
                value
                type
              }
            }
          }
        }
      }
    }
  }
`

export const BULK_INVENTORY_QUERY = `
  {
    inventoryItems {
      edges {
        node {
          id
          sku
          tracked
          requiresShipping
          inventoryLevels {
            edges {
              node {
                id
                available
                location {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`

// Webhook Queries
export const GET_WEBHOOKS_QUERY = `
  query GetWebhooks($first: Int!) {
    webhookSubscriptions(first: $first) {
      edges {
        node {
          id
          callbackUrl
          topic
          format
          createdAt
          updatedAt
        }
      }
    }
  }
`

export const CREATE_WEBHOOK_MUTATION = `
  mutation CreateWebhook($input: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $input.topic, callbackUrl: $input.callbackUrl, format: $input.format) {
      webhookSubscription {
        id
        callbackUrl
        topic
        format
        createdAt
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

// Shop Information Query
export const GET_SHOP_QUERY = `
  query GetShop {
    shop {
      id
      name
      email
      domain
      myshopifyDomain
      currencyCode
      currencyFormats {
        moneyFormat
        moneyWithCurrencyFormat
      }
      timezoneAbbreviation
      plan {
        displayName
        partnerDevelopment
        shopifyPlus
      }
    }
  }
`