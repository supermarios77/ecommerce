import { MedusaContainer } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function initial_data_seed({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  );

  const countries = ["gb", "de", "dk", "se", "fr", "es", "it"];

  logger.info("Seeding store data...");
  const {
    result: [defaultSalesChannel],
  } = await createSalesChannelsWorkflow(container).run({
    input: {
      salesChannelsData: [
        {
          name: "MR Cricket Channel",
          description: "MR Cricket equipment sales channel",
        },
      ],
    },
  });

  const {
    result: [publishableApiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: "Default Publishable API Key",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel.id],
    },
  });

  const {
    result: [store],
  } = await createStoresWorkflow(container).run({
    input: {
      stores: [
        {
          name: "MR Cricket",
          supported_currencies: [
            {
              currency_code: "eur",
              is_default: true,
            },
            {
              currency_code: "usd",
              is_default: false,
            },
          ],
          default_sales_channel_id: defaultSalesChannel.id,
        },
      ],
    },
  });

  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Europe",
          currency_code: "eur",
          countries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "European Warehouse",
          address: {
            city: "Copenhagen",
            country_code: "DK",
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  // This is created by a migration script in core.
  const { data: shippingProfileResult } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  });
  const shippingProfile = shippingProfileResult[0];

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "European Warehouse delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Europe",
        geo_zones: [
          {
            country_code: "gb",
            type: "country",
          },
          {
            country_code: "de",
            type: "country",
          },
          {
            country_code: "dk",
            type: "country",
          },
          {
            country_code: "se",
            type: "country",
          },
          {
            country_code: "fr",
            type: "country",
          },
          {
            country_code: "es",
            type: "country",
          },
          {
            country_code: "it",
            type: "country",
          },
        ],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 2-3 days.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 10,
          },
          {
            currency_code: "eur",
            amount: 10,
          },
          {
            region_id: region.id,
            amount: 10,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Express Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 24 hours.",
          code: "express",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 10,
          },
          {
            currency_code: "eur",
            amount: 10,
          },
          {
            region_id: region.id,
            amount: 10,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel.id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding product data...");

  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Cricket Bats",
          is_active: true,
        },
        {
          name: "Cricket Balls",
          is_active: true,
        },
        {
          name: "Protective Gear",
          is_active: true,
        },
        {
          name: "Clothing",
          is_active: true,
        },
        {
          name: "Accessories",
          is_active: true,
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "English Willow Cricket Bat",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Cricket Bats")!.id,
          ],
          description:
            "Premium Grade 1 English willow cricket bat, perfect for professional players. Excellent balance and power with traditional sweet spot.",
          handle: "english-willow-cricket-bat",
          weight: 1200,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["Size 5", "Size 6", "Full Size"],
            },
            {
              title: "Grade",
              values: ["Grade 1", "Grade 2", "Grade 3"],
            },
          ],
          variants: [
            {
              title: "Size 5 / Grade 1",
              sku: "BAT-S5-G1",
              options: {
                Size: "Size 5",
                Grade: "Grade 1",
              },
              prices: [
                {
                  amount: 299,
                  currency_code: "eur",
                },
                {
                  amount: 329,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Size 6 / Grade 1",
              sku: "BAT-S6-G1",
              options: {
                Size: "Size 6",
                Grade: "Grade 1",
              },
              prices: [
                {
                  amount: 329,
                  currency_code: "eur",
                },
                {
                  amount: 359,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Full Size / Grade 1",
              sku: "BAT-FS-G1",
              options: {
                Size: "Full Size",
                Grade: "Grade 1",
              },
              prices: [
                {
                  amount: 349,
                  currency_code: "eur",
                },
                {
                  amount: 379,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Full Size / Grade 2",
              sku: "BAT-FS-G2",
              options: {
                Size: "Full Size",
                Grade: "Grade 2",
              },
              prices: [
                {
                  amount: 249,
                  currency_code: "eur",
                },
                {
                  amount: 279,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Leather Cricket Ball",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Cricket Balls")!.id,
          ],
          description:
            "Premium leather cricket ball, hand-stitched for professional matches. Excellent shape retention and durability.",
          handle: "leather-cricket-ball",
          weight: 160,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&q=80",
            },
          ],
          options: [
            {
              title: "Color",
              values: ["Red", "White", "Pink"],
            },
            {
              title: "Type",
              values: ["Match", "Training"],
            },
          ],
          variants: [
            {
              title: "Red / Match",
              sku: "BALL-RED-MATCH",
              options: {
                Color: "Red",
                Type: "Match",
              },
              prices: [
                {
                  amount: 25,
                  currency_code: "eur",
                },
                {
                  amount: 28,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "White / Match",
              sku: "BALL-WHITE-MATCH",
              options: {
                Color: "White",
                Type: "Match",
              },
              prices: [
                {
                  amount: 25,
                  currency_code: "eur",
                },
                {
                  amount: 28,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Red / Training",
              sku: "BALL-RED-TRAINING",
              options: {
                Color: "Red",
                Type: "Training",
              },
              prices: [
                {
                  amount: 15,
                  currency_code: "eur",
                },
                {
                  amount: 18,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Batting Pads Set",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Protective Gear")!.id,
          ],
          description:
            "Professional-grade batting pads with lightweight design and superior protection. Includes left and right pads with adjustable straps.",
          handle: "batting-pads-set",
          weight: 800,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["Junior", "Youth", "Senior"],
            },
            {
              title: "Color",
              values: ["Black", "Navy", "White"],
            },
          ],
          variants: [
            {
              title: "Junior / Black",
              sku: "PADS-JUNIOR-BLACK",
              options: {
                Size: "Junior",
                Color: "Black",
              },
              prices: [
                {
                  amount: 45,
                  currency_code: "eur",
                },
                {
                  amount: 50,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Youth / Black",
              sku: "PADS-YOUTH-BLACK",
              options: {
                Size: "Youth",
                Color: "Black",
              },
              prices: [
                {
                  amount: 55,
                  currency_code: "eur",
                },
                {
                  amount: 60,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Senior / Black",
              sku: "PADS-SENIOR-BLACK",
              options: {
                Size: "Senior",
                Color: "Black",
              },
              prices: [
                {
                  amount: 65,
                  currency_code: "eur",
                },
                {
                  amount: 70,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Senior / Navy",
              sku: "PADS-SENIOR-NAVY",
              options: {
                Size: "Senior",
                Color: "Navy",
              },
              prices: [
                {
                  amount: 65,
                  currency_code: "eur",
                },
                {
                  amount: 70,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Cricket Helmet Pro",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Protective Gear")!.id,
          ],
          description:
            "Professional cricket helmet with advanced impact protection and ventilation. Meets international safety standards with reinforced grille.",
          handle: "cricket-helmet-pro",
          weight: 600,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["Small", "Medium", "Large"],
            },
            {
              title: "Color",
              values: ["Black", "Navy", "Red"],
            },
          ],
          variants: [
            {
              title: "Small / Black",
              sku: "HELMET-SMALL-BLACK",
              options: {
                Size: "Small",
                Color: "Black",
              },
              prices: [
                {
                  amount: 75,
                  currency_code: "eur",
                },
                {
                  amount: 85,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Medium / Black",
              sku: "HELMET-MEDIUM-BLACK",
              options: {
                Size: "Medium",
                Color: "Black",
              },
              prices: [
                {
                  amount: 75,
                  currency_code: "eur",
                },
                {
                  amount: 85,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Large / Black",
              sku: "HELMET-LARGE-BLACK",
              options: {
                Size: "Large",
                Color: "Black",
              },
              prices: [
                {
                  amount: 75,
                  currency_code: "eur",
                },
                {
                  amount: 85,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Medium / Navy",
              sku: "HELMET-MEDIUM-NAVY",
              options: {
                Size: "Medium",
                Color: "Navy",
              },
              prices: [
                {
                  amount: 75,
                  currency_code: "eur",
                },
                {
                  amount: 85,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
      ],
    },
  });
  logger.info("Finished seeding product data.");

  logger.info("Seeding inventory levels.");

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryItems.map((item) => ({
        location_id: stockLocation.id,
        stocked_quantity: 1000000,
        inventory_item_id: item.id,
      })),
    },
  });

  logger.info("Finished seeding inventory levels data.");
}
