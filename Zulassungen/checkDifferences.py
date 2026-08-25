'''
Created on 30.10.2014

@author: Nils Baumgartner (adaptions for Mac and Python)
A simple skript checking the permissions of students.
'''
# !/usr/local/bin/python2.7
# encoding: utf-8


## USAGE: python3 checkDifferences.py ./check.csv ./result.csv

import pandas as pd
import argparse

def find_differences(csv_path1, csv_path2):
    # Read the CSV files into pandas DataFrames
    print("Find differences")
    df1 = pd.read_csv(csv_path1, header=None)
    df2 = pd.read_csv(csv_path2, header=None)

    # Use the first column (0) as index. Change this if your identifier is in a different column
    df1.set_index(0, inplace=True)
    df2.set_index(0, inplace=True)

    # Perform an outer join on the dataframes to merge them
    df = df1.join(df2, how='outer', lsuffix='_df1', rsuffix='_df2')

    print(df)
    # Iterate over the rows and compare the values from df1 and df2
    for index, row in df.iterrows():
        print("Check index: "+str(index))
        for column in df.columns:
            print(column)
            if str(row[column + '_df1']) != str(row[column + '_df2']):
                print(f"Difference found at id {index}, column {column}: {row[column + '_df1']} != {row[column + '_df2']}")

def main():
    parser = argparse.ArgumentParser(description='Find differences between two CSV files.')
    parser.add_argument('csv1', help='Path to the first CSV file.')
    parser.add_argument('csv2', help='Path to the second CSV file.')
    args = parser.parse_args()

    find_differences(args.csv1, args.csv2)

if __name__ == '__main__':
    main()
