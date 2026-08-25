import pandas as pd
import sys
import os
import warnings
warnings.simplefilter("ignore", UserWarning)

# Read the .xlsx file
df = pd.read_excel('check.xlsx', sheet_name=0, header=2, skiprows=[0, 1])

# Extract the columns we need
df = df[['Nachname', 'Vorname', 'Matrikelnummer']]

# Set the column names to match the desired output format
df.columns = ['Lastname', 'Firstname', 'Matriculation number']

if os.path.exists("check.csv"):
    os.remove("check.csv")

print(df[:-1])

# Write the CSV file in UTF-8 encoding
# df[:-1] ignore the last line which contains "endHISsheet"
df[:-1].to_csv('check.csv', sep=';', encoding='utf-8', index=False, header=False)