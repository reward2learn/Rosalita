'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';

// ── Mock Menu Data (Rosalita Cantina inspired) ─────────

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number; // IDR thousands
  category: string;
  isPopular?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  // Snacks
  { id: 's1', name: 'Nachos Queso', description: 'Corn tortilla chips with queso sauce, melted cheese, red beans, tomato salsa, guacamole, sour cream & jalapenos.', price: 98, category: 'Snacks', isPopular: true },
  { id: 's2', name: 'Nachos Grande', description: 'Corn tortilla chips with queso sauce, melted cheese, red beans, tomato salsa, guacamole, sour cream, jalapenos & minced beef.', price: 113, category: 'Snacks' },
  { id: 's3', name: 'Jalapeño Poppers (4pcs)', description: 'Fresh jalapeños, breaded & stuffed with mozzarella, pepper jack & cream cheese, served with chipotle mayo.', price: 92, category: 'Snacks' },
  { id: 's4', name: 'Chicken Wings (6pcs)', description: 'Deep fried chicken wings with carrot & cucumber sticks, blue cheese sauce, choice of honey BBQ or honey soy.', price: 89, category: 'Snacks', isPopular: true },
  { id: 's5', name: 'Chicken Wings (12pcs)', description: 'Deep fried chicken wings with carrot & cucumber sticks, blue cheese sauce, choice of honey BBQ or honey soy.', price: 129, category: 'Snacks' },
  { id: 's6', name: 'Mi Amigo Sharing Platter', description: 'Mixed platter of chicken fingers, fish fingers, calamari rings, chicken wings & nachos queso.', price: 189, category: 'Snacks', isPopular: true },
  { id: 's7', name: 'Calamari Rings', description: 'Homemade battered calamari rings, served with tartar sauce.', price: 79, category: 'Snacks' },
  { id: 's8', name: 'Empanadas (2pcs)', description: 'Deep fried empanadas filled with cheese mix & shredded beef, served with chipotle mayo.', price: 69, category: 'Snacks' },

  // Mains
  { id: 'm1', name: "Rosalita's Burger", description: '120gr grilled beef with lettuce, tomato, pickles, cheese mix & chipotle mayo.', price: 132, category: 'Mains', isPopular: true },
  { id: 'm2', name: 'Chicken Burger', description: 'Herb buttermilk crispy fried boneless chicken thigh with red onions, lettuce, cheese mix & sriracha aioli.', price: 120, category: 'Mains' },
  { id: 'm3', name: 'Rib Eye Steak', description: '200g grilled rib eye steak with sauteed vegetables, choice of sides & sauce.', price: 239, category: 'Mains' },
  { id: 'm4', name: 'Baby Back Pork Ribs (400gr)', description: '400g slow cooked baby back ribs with honey BBQ sauce, sauteed vegetables & choice of potatoes.', price: 285, category: 'Mains' },
  { id: 'm5', name: 'Pork Chop', description: '300gr grilled pork chop with sauteed vegetables, honey mustard glaze & choice of sides.', price: 179, category: 'Mains' },
  { id: 'm6', name: 'Texas Mac And Cheese', description: 'Creamy homemade baked mac and cheese with grilled chicken chunks.', price: 98, category: 'Mains' },
  { id: 'm7', name: 'Grilled Chicken Breast', description: '200gr pan seared chicken breast with garlic herb butter, sauteed vegetables, choice of potatoes & sauces.', price: 133, category: 'Mains' },

  // Tacos & Burritos
  { id: 't1', name: 'Shredded Chicken Taco (2pc)', description: 'Soft or hard shell taco with shredded chicken, salsa, cabbage, cheese & guacamole.', price: 85, category: 'Tacos & Burritos' },
  { id: 't2', name: 'Chimichurri Steak Taco (2pc)', description: 'Soft or hard shell taco with chimichurri steak, salsa, cabbage, cheese & guacamole.', price: 105, category: 'Tacos & Burritos', isPopular: true },
  { id: 't3', name: 'Shredded Chicken Burrito', description: '12" flour tortilla with red beans, salsa, cheese, guacamole, lettuce, sour cream & spanish rice.', price: 98, category: 'Tacos & Burritos' },
  { id: 't4', name: 'Chimichurri Steak Burrito', description: '12" flour tortilla with chimichurri steak, red beans, salsa, cheese, guacamole & spanish rice.', price: 128, category: 'Tacos & Burritos' },
  { id: 't5', name: 'ONE METER LONG BURRITO!', description: "Rosalita's signature 1-meter burrito with four tortillas, cheese, guacamole, beans, salsa & rice.", price: 450, category: 'Tacos & Burritos', isPopular: true },

  // Desserts
  { id: 'd1', name: 'Churros (6pcs)', description: 'Served with chocolate & caramel sauce.', price: 49, category: 'Desserts' },
  { id: 'd2', name: 'Key Lime Pie', description: 'Classic key lime pie served with whipped cream.', price: 59, category: 'Desserts', isPopular: true },
  { id: 'd3', name: 'Warm Brownie', description: 'Warm chocolate brownie served with vanilla ice cream.', price: 49, category: 'Desserts' },
  { id: 'd4', name: 'Churros Split', description: 'Churros with 2 scoops of gelato & caramel sauce.', price: 59, category: 'Desserts' },
  { id: 'd5', name: 'Gelato Scoop', description: 'Choice of strawberry, vanilla, or chocolate gelato with chocolate sauce.', price: 25, category: 'Desserts' },

  // Beverages
  { id: 'b1', name: 'Soft Drinks', description: 'Coca-Cola, Sprite, Fanta, or soda water.', price: 25, category: 'Beverages' },
  { id: 'b2', name: 'Fresh Juice', description: 'Freshly squeezed orange, watermelon, or mango juice.', price: 35, category: 'Beverages' },
  { id: 'b3', name: 'Iced Tea', description: 'Homemade ice tea with lemon.', price: 28, category: 'Beverages' },
  { id: 'b4', name: 'Mineral Water', description: 'Bottled spring water 600ml.', price: 15, category: 'Beverages' },
];

const CATEGORIES = [...new Set(MENU_ITEMS.map((i) => i.category))];

export function MenuView() {
  const [category, setCategory] = useState<string>('All');

  const filtered = useMemo(() => {
    if (category === 'All') return MENU_ITEMS;
    return MENU_ITEMS.filter((i) => i.category === category);
  }, [category]);

  const grouped = useMemo(() => {
    const map: Record<string, MenuItem[]> = {};
    for (const item of filtered) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return map;
  }, [filtered]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <RestaurantMenuIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Menu
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {MENU_ITEMS.length} items · Prices in IDR thousands (K)
          </Typography>
        </Box>
      </Stack>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={category}
            label="Category"
            onChange={(e) => setCategory(e.target.value)}
          >
            <MenuItem value="All">All Categories</MenuItem>
            {CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {/* Menu Items */}
      {Object.entries(grouped).map(([cat, items]) => (
        <Box key={cat} sx={{ mb: 4 }}>
          <Typography variant="h5" fontWeight={600} sx={{ mb: 2, color: 'primary.main' }}>
            {cat}
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              ({items.length} items)
            </Typography>
          </Typography>
          <Grid container spacing={2}>
            {items.map((item) => (
              <Grid item key={item.id} xs={12} sm={6} md={4}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    transition: 'box-shadow 0.2s',
                    '&:hover': { boxShadow: 2 },
                    '&:focus-visible': { boxShadow: 2 },
                    ...(item.isPopular ? { borderColor: 'warning.main', borderWidth: 2 } : {}),
                  }}
                >
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>
                        {item.name}
                      </Typography>
                      <Typography variant="subtitle1" fontWeight={700} color="primary" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                        {item.price} K
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {item.description}
                    </Typography>
                    {item.isPopular && (
                      <Chip
                        icon={<LocalOfferIcon />}
                        label="Popular"
                        size="small"
                        color="warning"
                        sx={{ mt: 1 }}
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Box>
  );
}
